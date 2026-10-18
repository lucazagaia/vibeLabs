# Smoke test results: Nemotron on Token Factory

Base URL: `https://api.tokenfactory.nebius.com/v1` · run at 2026-10-18 14:38

| Model | Test | Result | Latency (ms) | Reasoning location | Notes |
|---|---|---|---|---|---|
| nvidia/Nemotron-3_5-Lightning | T1 catalog | ✅ |  |  | listed |
| nvidia/nemotron-3-super-120b-a12b | T1 catalog | ✅ |  |  | listed |
| nvidia/Nemotron-3_5-Lightning | T2 plain answer | ✅ | 1233 | reasoning_content | content='OK' |
| nvidia/Nemotron-3_5-Lightning | T3 forced tool | ✅ | 926 | reasoning_content | call=dataset_info |
| nvidia/Nemotron-3_5-Lightning | T4 auto tool | ✅ | 259 | reasoning_content | call=dataset_info, reasoning_tokens=8 |
| nvidia/Nemotron-3_5-Lightning | T5 tool result | ✅ | 474 | reasoning_content | content='The dataset contains **10,000 suppliers**.' |
| nvidia/Nemotron-3_5-Lightning | T6 streaming tool | ✅ | 298 | reasoning_content | call=dataset_info, reasoning_tokens=0 |
| nvidia/Nemotron-3_5-Lightning | T7 effort=none | ✅ | 272 | none | call=dataset_info, reasoning_tokens=0 |
| nvidia/Nemotron-3_5-Lightning | T7 effort=low | ✅ | 305 | reasoning_content | call=dataset_info, reasoning_tokens=18 |
| nvidia/Nemotron-3_5-Lightning | T7 effort=medium | ✅ | 553 | reasoning_content | call=dataset_info, reasoning_tokens=59 |
| nvidia/nemotron-3-super-120b-a12b | T2 plain answer | ✅ | 516 | reasoning_content | content='OK' |
| nvidia/nemotron-3-super-120b-a12b | T3 forced tool | ✅ | 615 | reasoning_content | call=dataset_info |
| nvidia/nemotron-3-super-120b-a12b | T4 auto tool | ✅ | 635 | reasoning_content | call=dataset_info, reasoning_tokens=9 |
| nvidia/nemotron-3-super-120b-a12b | T5 tool result | ✅ | 668 | reasoning_content | content='The dataset contains **10,000** suppliers.' |
| nvidia/nemotron-3-super-120b-a12b | T6 streaming tool | ✅ | 662 | reasoning_content | call=dataset_info, reasoning_tokens=0 |
| nvidia/nemotron-3-super-120b-a12b | T7 effort=none | ✅ | 669 | none | call=dataset_info, reasoning_tokens=0 |
| nvidia/nemotron-3-super-120b-a12b | T7 effort=low | ✅ | 937 | reasoning_content | call=dataset_info, reasoning_tokens=9 |
| nvidia/nemotron-3-super-120b-a12b | T7 effort=medium | ✅ | 882 | reasoning_content | call=dataset_info, reasoning_tokens=71 |
