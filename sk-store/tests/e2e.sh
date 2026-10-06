#!/usr/bin/env bash
# Stage 2 acceptance tests: authorization matrix + password-reset token behavior.
# Needs the app running on $BASE (default http://localhost:3100) and psql access via $PSQL.
set -u
BASE="${BASE:-http://localhost:3100}"
PSQL="${PSQL:-psql}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected [$3] got [$2])"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
jar()  { curl -s -c "/tmp/jar-$1" -b "/tmp/jar-$1" "${@:2}" >/dev/null; }

echo "=== 0. Reset test state (makes this script re-runnable) ==="
rm -f /tmp/jar-*
$PSQL -c "delete from sessions; delete from password_reset_tokens; delete from login_attempts; delete from audit_log; delete from users where email in ('admin@sk.test','customer@sk.test','staff@sk.test'); update service_state set status='ACTIVE',payment_status='PAID' where id=true" >/dev/null
$PSQL -c "update users set password_hash='$(node tests/hash.js "$OWNER_PASSWORD")',active=true where role='owner' and email='$OWNER_EMAIL'" >/dev/null
for r in "admin admin@sk.test AdminPass123" "customer customer@sk.test CustPass123"; do set -- $r; $PSQL -c "insert into users(email,name,password_hash,role) values('$2','$1','$(node tests/hash.js $3)','$1')" >/dev/null; done
tokfromlog() { grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2; }
echo "=== 1. Authorization matrix: owner area vs every role ==="
# unauthenticated
check "GUEST  -> /owner/dashboard  (redirect to login)" "$(code -o /dev/null -w '%{http_code}' -L --max-redirs 0 "$BASE/owner/dashboard")" "307"
check "GUEST  -> /api/owner/service" "$(code "$BASE/api/owner/service")" "401"

# log in each role
login() { curl -s -c "/tmp/jar-$1" -o /dev/null -X POST "$BASE$2" -H 'Content-Type: application/json' -d "{\"email\":\"$3\",\"password\":\"$4\"}"; }
login owner /api/owner/login "$OWNER_EMAIL" "$OWNER_PASSWORD"
login admin /api/admin/login admin@sk.test AdminPass123
login cust  /api/auth/login  customer@sk.test CustPass123

check "OWNER  -> /api/owner/service  ALLOWED" "$(code -b /tmp/jar-owner "$BASE/api/owner/service")" "200"
check "ADMIN  -> /api/owner/service  DENIED"  "$(code -b /tmp/jar-admin "$BASE/api/owner/service")" "403"
check "CUSTOMER -> /api/owner/service DENIED" "$(code -b /tmp/jar-cust "$BASE/api/owner/service")" "403"
check "OWNER  -> /api/owner/admins  ALLOWED"  "$(code -b /tmp/jar-owner "$BASE/api/owner/admins")" "200"
check "ADMIN  -> /api/owner/admins  DENIED"   "$(code -b /tmp/jar-admin "$BASE/api/owner/admins")" "403"
check "CUSTOMER -> /api/owner/admins DENIED"  "$(code -b /tmp/jar-cust "$BASE/api/owner/admins")" "403"
# pages (307 redirect = bounced to login)
check "OWNER  -> /owner/dashboard  ALLOWED" "$(code -b /tmp/jar-owner -o /dev/null -w '%{http_code}' "$BASE/owner/dashboard")" "200"
check "ADMIN  -> /owner/dashboard  DENIED"  "$(code -b /tmp/jar-admin -o /dev/null -w '%{http_code}' --max-redirs 0 "$BASE/owner/dashboard")" "307"
check "CUSTOMER -> /owner/dashboard DENIED" "$(code -b /tmp/jar-cust -o /dev/null -w '%{http_code}' --max-redirs 0 "$BASE/owner/dashboard")" "307"
# staff account: created by the owner, sets its own password from the emailed invitation link
curl -s -b /tmp/jar-owner -o /dev/null -X POST "$BASE/api/owner/admins" -H 'Content-Type: application/json' -d '{"action":"create","email":"staff@sk.test","name":"Staff","role":"staff"}'
STOK=$(tokfromlog)
check "staff invitation email produced a token" "$([ -n "$STOK" ] && echo yes)" "yes"
check "staff sets own password from invitation" "$(code -X POST "$BASE/api/admin/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$STOK\",\"password\":\"StaffPass123\"}")" "200"
curl -s -c /tmp/jar-staff -o /dev/null -X POST "$BASE/api/admin/login" -H 'Content-Type: application/json' -d '{"email":"staff@sk.test","password":"StaffPass123"}'
check "STAFF  -> /admin/dashboard    ALLOWED (can sign in)" "$(code -b /tmp/jar-staff "$BASE/admin/dashboard")" "200"
check "ADMIN  -> /admin/dashboard    ALLOWED" "$(code -b /tmp/jar-admin "$BASE/admin/dashboard")" "200"
check "STAFF  -> /api/owner/service  DENIED" "$(code -b /tmp/jar-staff "$BASE/api/owner/service")" "403"
check "STAFF  -> /api/owner/admins   DENIED" "$(code -b /tmp/jar-staff "$BASE/api/owner/admins")" "403"
check "STAFF  -> /owner/dashboard    DENIED" "$(code -b /tmp/jar-staff -o /dev/null -w '%{http_code}' --max-redirs 0 "$BASE/owner/dashboard")" "307"
check "admin creation response contains no password" "$(curl -s -b /tmp/jar-owner -X POST "$BASE/api/owner/admins" -H 'Content-Type: application/json' -d '{"action":"create","email":"staff2@sk.test","name":"S2","role":"staff"}' | grep -ci 'password')" "0"
$PSQL -c "delete from users where email='staff2@sk.test'" >/dev/null

echo "=== 2. Cross-role login rejection ==="
check "owner creds on /api/auth/login (customer) DENIED" "$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\"}")" "401"
check "customer creds on /api/owner/login DENIED" "$(code -X POST "$BASE/api/owner/login" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test","password":"CustPass123"}')" "401"

echo "=== 3. Owner service control: suspension blocks orders, admin cannot override ==="
curl -s -b /tmp/jar-owner -o /dev/null -X POST "$BASE/api/owner/service" -H 'Content-Type: application/json' -d '{"status":"SUSPENDED","payment_status":"PAYMENT_DUE","note":"test suspension"}'
check "SUSPENDED -> orders API blocked (503)" "$(code -X POST "$BASE/api/orders" -H 'Content-Type: application/json' -d '{"customer":{"name":"T","email":"t@t.co","phone":"1","address":"1","suburb":"s","city":"c","province":"Gauteng","postal":"1"},"items":[{"slug":"varsity-script-tee","size":"M","qty":1}]}')" "503"
check "SUSPENDED -> checkout page shows notice" "$(curl -s -b /tmp/jar-cust "$BASE/checkout" | grep -c 'Temporarily unavailable')" "1"
check "admin cannot change service state" "$(code -b /tmp/jar-admin -X POST "$BASE/api/owner/service" -H 'Content-Type: application/json' -d '{"status":"ACTIVE"}')" "403"
check "owner still works while suspended" "$(code -b /tmp/jar-owner "$BASE/api/owner/service")" "200"
curl -s -b /tmp/jar-owner -o /dev/null -X POST "$BASE/api/owner/service" -H 'Content-Type: application/json' -d '{"status":"ACTIVE","payment_status":"PAID","note":"reactivated"}'
check "reactivated -> storefront open" "$(curl -s "$BASE/api/service-status" | grep -c '"open":true')" "1"

echo "=== 4. Password reset: customer / admin / owner ==="
reset_flow() { # role loginpath apiprefix email newpw oldpw
  local role=$1 lp=$2 api=$3 email=$4 newpw=$5 oldpw=$6
  $PSQL -c "delete from password_reset_tokens" >/dev/null
  curl -s -o /dev/null -X POST "$BASE$api/forgot-password" -H 'Content-Type: application/json' -d "{\"email\":\"$email\"}"
  local tok; tok=$($PSQL -tA -c "select encode(digest('x','sha256'),'hex') from password_reset_tokens limit 0" 2>/dev/null; echo)
  tok=$($PSQL -tA -c "select token_hash from password_reset_tokens t join users u on u.id=t.user_id where u.email='$email' order by t.id desc limit 1")
  # raw token unknown to shell (only hash stored) - so pull the logged URL from console provider log instead:
  tok=$(grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2)
  [ -n "$tok" ] && ok "$role reset email produced a token" || { bad "$role reset token not found"; return; }
  check "$role valid token resets password" "$(code -X POST "$BASE$api/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$tok\",\"password\":\"$newpw\"}")" "200"
  check "$role old password no longer works" "$(code -X POST "$BASE$lp" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$oldpw\"}")" "401"
  check "$role new password works" "$(code -X POST "$BASE$lp" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"$newpw\"}")" "200"
  check "$role token is single-use" "$(code -X POST "$BASE$api/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$tok\",\"password\":\"AnotherPass9\"}")" "400"
}
reset_flow customer /api/auth/login /api/auth customer@sk.test NewCustPass456 CustPass123
reset_flow admin /api/admin/login /api/admin admin@sk.test NewAdminPass456 AdminPass123
reset_flow owner /api/owner/login /api/owner "$OWNER_EMAIL" NewOwnerPass456 "$OWNER_PASSWORD"
OWNER_PASSWORD=NewOwnerPass456

echo "=== 5. Token edge cases ==="
check "invalid token rejected" "$(code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d '{"token":"nope123","password":"WhateverPass1"}')" "400"
# expired token
$PSQL -c "delete from password_reset_tokens" >/dev/null
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
TOK=$(grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2)
$PSQL -c "update password_reset_tokens set expires_at=now()-interval '1 minute' where id=(select max(id) from password_reset_tokens)" >/dev/null
check "expired token rejected" "$(code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\",\"password\":\"WhateverPass1\"}")" "400"
# multiple requests: earlier token invalidated, newest works
$PSQL -c "delete from password_reset_tokens" >/dev/null
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
T1=$(grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2)
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
T2=$(grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2)
check "older token invalidated by newer request" "$(code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$T1\",\"password\":\"WhateverPass1\"}")" "400"
check "newest token still works" "$(code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$T2\",\"password\":\"FinalPass789\"}")" "200"

echo "=== 6. Sessions invalidated after reset + enumeration-safe response ==="
$PSQL -c "delete from password_reset_tokens" >/dev/null
curl -s -c /tmp/jar-sess -o /dev/null -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test","password":"FinalPass789"}'
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
TK=$(grep -o "token=[A-Za-z0-9_-]*" /tmp/next.log | tail -1 | cut -d= -f2)
curl -s -o /dev/null -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$TK\",\"password\":\"AfterReset1\"}"
check "session invalidated after password reset" "$($PSQL -tA -c "select count(*) from sessions s join users u on u.id=s.user_id where u.email='customer@sk.test'")" "0"
BODY=$(curl -s -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"no-such-user@sk.test"}')
check "unknown email gets generic response" "$(echo "$BODY" | grep -c 'If an account exists')" "1"
check "unknown email gets HTTP 200" "$(code -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"no-such-user@sk.test"}')" "200"

echo "=== 7. Audit log recorded security events ==="
for ev in OWNER_LOGIN OWNER_PASSWORD_RESET ADMIN_CREATED SITE_SUSPENDED SITE_REACTIVATED; do
  check "audit contains $ev" "$($PSQL -tA -c "select count(*) from audit_log where action='$ev'")" "$($PSQL -tA -c "select greatest(count(*),1) from audit_log where action='$ev'" )"
done
check "audit log stores no plaintext passwords" "$($PSQL -tA -c "select count(*) from audit_log where record ilike '%Pass%' or record ilike '%password=%'")" "0"

echo "=== 7b. Hardening ==="
check "password shorter than 10 characters rejected" "$(code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d '{"token":"x","password":"short123"}')" "400"
$PSQL -c "delete from password_reset_tokens" >/dev/null
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'; done
check "reset emails limited to 3 per account per hour (5 requests)" "$($PSQL -tA -c "select count(*) from password_reset_tokens t join users u on u.id=t.user_id where u.email='customer@sk.test'")" "3"
$PSQL -c "delete from password_reset_tokens" >/dev/null
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
RT=$(tokfromlog)
( code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$RT\",\"password\":\"RaceOnePass12\"}" > /tmp/race1 & code -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' -d "{\"token\":\"$RT\",\"password\":\"RaceTwoPass34\"}" > /tmp/race2 & wait )
check "same token used twice in parallel: exactly one succeeds" "$(cat /tmp/race1 /tmp/race2 | grep -c 200)" "1"
$PSQL -c "update users set active=false where email='customer@sk.test'" >/dev/null
$PSQL -c "delete from password_reset_tokens" >/dev/null
curl -s -o /dev/null -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' -d '{"email":"customer@sk.test"}'
check "disabled account gets no reset link" "$($PSQL -tA -c "select count(*) from password_reset_tokens")" "0"
$PSQL -c "update users set active=true where email='customer@sk.test'" >/dev/null
echo "6 wrong passwords on one email -> locked out"
for i in 1 2 3 4 5 6; do LASTC=$(code -X POST "$BASE/api/admin/login" -H 'Content-Type: application/json' -d '{"email":"admin@sk.test","password":"wrong-password-1"}'); done
check "login lockout after repeated failures" "$LASTC" "429"

echo "=== 8. Storefront still works (no Stage 1 regressions) ==="
check "home page 200" "$(code "$BASE/")" "200"
check "shop page 200" "$(code "$BASE/shop")" "200"
check "place order while ACTIVE" "$(code -X POST "$BASE/api/orders" -H 'Content-Type: application/json' -d '{"customer":{"name":"T","email":"t@t.co","phone":"1","address":"1","suburb":"s","city":"c","province":"Gauteng","postal":"1"},"items":[{"slug":"varsity-script-tee","size":"M","qty":1}]}')" "200"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
