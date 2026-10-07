// Install playwright separately and run against a local test server on port 3100. No production writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const desktop=await browser.newContext({viewport:{width:1365,height:1000},colorScheme:'light'});
 const page=await desktop.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3100/shop?cat=Beanies'); await page.waitForTimeout(600);
 console.log('shop URL',page.url());
 await page.screenshot({path:'/downloads/beanie-shop-desktop.png',fullPage:true});
 await page.goto('http://localhost:3100/product/beanie-black-stars');await page.waitForTimeout(400);
 await page.screenshot({path:'/downloads/beanie-product-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Next photo',exact:true}).click();await page.waitForTimeout(500);
 assert.equal(await page.locator('.gallery-count').textContent(),'2 / 2');
 await page.screenshot({path:'/downloads/beanie-product-contact-sheet.png',fullPage:true});
 await page.locator('.gallery-track').focus();await page.keyboard.press('Home');await page.waitForTimeout(500);assert.equal(await page.locator('.gallery-count').textContent(),'1 / 2');
 await page.getByRole('button',{name:'Add to cart',exact:true}).click();await page.getByRole('status').waitFor();
 let cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('sk-cart')));assert.equal(cart[0].slug,'beanie-black-stars');assert.equal(cart[0].price_cents,24000);assert.equal(cart[0].size,'One size');assert.ok(cart[0].image.endsWith('beanie-black-stars.png'));
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'light'});const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));
 await m.goto('http://localhost:3100/shop?cat=Beanies');await m.waitForTimeout(500);
 console.log('mobile product names',await m.locator('.card h3').allTextContents());
 assert.equal(await m.locator('.card h3').filter({hasText:'Doodle Beanie'}).count(),0);
 const card=m.locator('.card').filter({hasText:'Black stars'});await card.scrollIntoViewIfNeeded();
 await card.getByRole('button',{name:'Next photo',exact:true}).click();await m.waitForTimeout(500);assert.equal(await card.locator('.gallery-count').textContent(),'2 / 2');assert.ok(m.url().includes('/shop'));
 await m.screenshot({path:'/downloads/beanie-shop-mobile.png',fullPage:true});
 await card.getByRole('link',{name:'View Black stars',exact:true}).last().click();await m.waitForTimeout(500);
 await m.screenshot({path:'/downloads/beanie-product-mobile.png',fullPage:true});
 const box=await m.locator('.gallery-track').boundingBox();const cdp=await mobile.newCDPSession(m);const y=box.y+box.height*.5,x=box.x+box.width*.85;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let j=1;j<=8;j++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-j*box.width*.085,y}]});await m.waitForTimeout(25);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(600);assert.equal(await m.locator('.gallery-count').textContent(),'2 / 2');
 assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await m.emulateMedia({reducedMotion:'reduce'});await m.getByRole('button',{name:'Previous photo',exact:true}).click();await m.waitForTimeout(100);assert.equal(await m.locator('.gallery-count').textContent(),'1 / 2');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS desktop arrows, keyboard, cart price/size/photo, card gallery without navigation, real touch swipe, reduced motion, no overflow or browser errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
