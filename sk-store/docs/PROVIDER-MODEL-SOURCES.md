# Sources checked October 8, 2026
- https://integrate.api.nvidia.com/v1/models live JSON catalog: old Meta 3.1/3.3 70B IDs absent; Nemotron Super ID present; list alone can contain deprecated models.
- https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b vendor page: hosted Free Endpoint Available, OpenAI-compatible model ID, instruction following/chat.
- https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b vendor reference: thinking can be disabled with chat_template_kwargs.enable_thinking=false.
- https://build.nvidia.com/meta/llama-3_3-70b-instruct vendor page: Free Endpoint Deprecated.
- https://build.nvidia.com/nvidia/llama-3_1-nemotron-70b-instruct vendor page: Free Endpoint Deprecated despite catalog entry.
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash vendor docs: stable ID, restricted access to previously active 2.5 users.
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite vendor docs: current stable low-latency model ID for new projects.
- https://ai.google.dev/gemini-api/docs/api-key vendor docs: new AI Studio keys default to authorization keys since May 28, 2026; native API x-goog-api-key authentication.
- https://raplsworks.hashnode.dev/your-new-gemini-api-key-starts-with-aq-not-aiza developer field report: newer keys AQ. format, native API transport works. Its claimed standard-key shutdown dates differ from current official documentation; do not use those dates.
