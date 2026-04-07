1. I can't add ingredients on a manual recipe!
2. Ingredients on manual recipe should lookup from the catalogue
3. recipes should indicate if they are a breakfast/lunch/dinner/dessert
4. When I click Edit on a reipe I get a blank page: Error in dev tools:
  ```index-iO7j07-X.js:40 TypeError: t is not iterable
      at Ul (index-iO7j07-X.js:270:13269)
      at index-iO7j07-X.js:270:23910
      at Array.map (<anonymous>)
      at a (index-iO7j07-X.js:270:23869)
      at index-iO7j07-X.js:270:24549
      at Object.Ti [as useState] (index-iO7j07-X.js:38:19893)
      at K.useState (index-iO7j07-X.js:9:6364)
      at du (index-iO7j07-X.js:270:24052)
      at vo (index-iO7j07-X.js:38:16981)
      at kd (index-iO7j07-X.js:40:43905)
  ja @ index-iO7j07-X.js:40
  Xc.n.callback @ index-iO7j07-X.js:40
  Li @ index-iO7j07-X.js:38
  Qi @ index-iO7j07-X.js:40
  pd @ index-iO7j07-X.js:40
  fm @ index-iO7j07-X.js:40
  gm @ index-iO7j07-X.js:40
  Ht @ index-iO7j07-X.js:40
  qi @ index-iO7j07-X.js:40
  Vt @ index-iO7j07-X.js:38
  (anonymous) @ index-iO7j07-X.js:40Understand this error
  index-iO7j07-X.js:270 Uncaught TypeError: t is not iterable
      at Ul (index-iO7j07-X.js:270:13269)
      at index-iO7j07-X.js:270:23910
      at Array.map (<anonymous>)
      at a (index-iO7j07-X.js:270:23869)
      at index-iO7j07-X.js:270:24549
      at Object.Ti [as useState] (index-iO7j07-X.js:38:19893)
      at K.useState (index-iO7j07-X.js:9:6364)
      at du (index-iO7j07-X.js:270:24052)
      at vo (index-iO7j07-X.js:38:16981)
      at kd (index-iO7j07-X.js:40:43905)```

5. On main page once loaded (through caddy) these errors appear
```/list:1 Access to manifest at 'https://cloudybutfine.cloudflareaccess.com/cdn-cgi/access/login/trolley.cbf.nz?kid=707f4111bb44279b8f778c769c33418d011f5343bf58012fded46179c4a4bed6&meta=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjdiZDRlODE4ZWNiODEwZDExYzE0YzZkMGYyMzQ1ODllODM3MWYxZDU3M2Q4OTg0NmZkNjhjYzE4ODFiM2Q5NzIifQ.eyJ0eXBlIjoibWV0YSIsImF1ZCI6IjcwN2Y0MTExYmI0NDI3OWI4Zjc3OGM3NjljMzM0MThkMDExZjUzNDNiZjU4MDEyZmRlZDQ2MTc5YzRhNGJlZDYiLCJob3N0bmFtZSI6InRyb2xsZXkuY2JmLm56IiwicmVkaXJlY3RfdXJsIjoiL21hbmlmZXN0Lmpzb24iLCJzZXJ2aWNlX3Rva2VuX3N0YXR1cyI6ZmFsc2UsImlzX3dhcnAiOmZhbHNlLCJpc19nYXRld2F5IjpmYWxzZSwiZXhwIjoxNzc1NjA0MTY1LCJuYmYiOjE3NzU2MDM4NjUsImlhdCI6MTc3NTYwMzg2NSwiYXV0aF9zdGF0dXMiOiJOT05FIiwibXRsc19hdXRoIjp7ImNlcnRfaXNzdWVyX2RuIjoiIiwiY2VydF9zZXJpYWwiOiIiLCJjZXJ0X2lzc3Vlcl9za2kiOiIiLCJjZXJ0X3ByZXNlbnRlZCI6ZmFsc2UsImNvbW1vbl9uYW1lIjoiIiwiYXV0aF9zdGF0dXMiOiJOT05FIn0sInJlYWxfY291bnRyeSI6Ik5aIiwiYXBwX3Nlc3Npb25faGFzaCI6ImRiNjgwN2RlNjk2YWE1N2VmYzZmNWU0YTM3NzE3ODk0OTQwOGFmNTNjMmI0NGMwYTVkYWRkMTViMzExZjFiZTMifQ.cQKF2W_ZhiKgS9GJKi23IR6r_MAWBP5AfX7NnC-hc7oONETv4kR4egE1DczMa-e8Yii_GFFbKkwm7ywks8azit-62lsGncxdXF49soNZ9BuJX1QSSAoiVifKOfVReh3dY394gzCStgOlC1V7ThZf3sfRdLd9O0oMGyIqjrlb0w3AMAdZxx8_nkmFhsdSRV3wdfSS0IybX-wKpKHaeaThF_i4M_ZRX2rqhR2qU7-pc3Fbh2s3DXicOmOnVm9C9pHwkxrOQFggks4QT_N2xUzrmX2t7e4Stgn4yJzPE4xs199mFMCFhekQrfbFK_gSNaMdMs1etvP6c_7XKdEhtpcPkg&redirect_url=%2Fmanifest.json' (redirected from 'https://trolley.cbf.nz/manifest.json') from origin 'https://trolley.cbf.nz' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.Understand this error
(index):24  GET https://cloudybutfine.cloudflareaccess.com/cdn-cgi/access/login/trolley.cbf.nz?kid=707f4111bb44279b8f778c769c33418d011f5343bf58012fded46179c4a4bed6&meta=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjdiZDRlODE4ZWNiODEwZDExYzE0YzZkMGYyMzQ1ODllODM3MWYxZDU3M2Q4OTg0NmZkNjhjYzE4ODFiM2Q5NzIifQ.eyJ0eXBlIjoibWV0YSIsImF1ZCI6IjcwN2Y0MTExYmI0NDI3OWI4Zjc3OGM3NjljMzM0MThkMDExZjUzNDNiZjU4MDEyZmRlZDQ2MTc5YzRhNGJlZDYiLCJob3N0bmFtZSI6InRyb2xsZXkuY2JmLm56IiwicmVkaXJlY3RfdXJsIjoiL21hbmlmZXN0Lmpzb24iLCJzZXJ2aWNlX3Rva2VuX3N0YXR1cyI6ZmFsc2UsImlzX3dhcnAiOmZhbHNlLCJpc19nYXRld2F5IjpmYWxzZSwiZXhwIjoxNzc1NjA0MTY1LCJuYmYiOjE3NzU2MDM4NjUsImlhdCI6MTc3NTYwMzg2NSwiYXV0aF9zdGF0dXMiOiJOT05FIiwibXRsc19hdXRoIjp7ImNlcnRfaXNzdWVyX2RuIjoiIiwiY2VydF9zZXJpYWwiOiIiLCJjZXJ0X2lzc3Vlcl9za2kiOiIiLCJjZXJ0X3ByZXNlbnRlZCI6ZmFsc2UsImNvbW1vbl9uYW1lIjoiIiwiYXV0aF9zdGF0dXMiOiJOT05FIn0sInJlYWxfY291bnRyeSI6Ik5aIiwiYXBwX3Nlc3Npb25faGFzaCI6ImRiNjgwN2RlNjk2YWE1N2VmYzZmNWU0YTM3NzE3ODk0OTQwOGFmNTNjMmI0NGMwYTVkYWRkMTViMzExZjFiZTMifQ.cQKF2W_ZhiKgS9GJKi23IR6r_MAWBP5AfX7NnC-hc7oONETv4kR4egE1DczMa-e8Yii_GFFbKkwm7ywks8azit-62lsGncxdXF49soNZ9BuJX1QSSAoiVifKOfVReh3dY394gzCStgOlC1V7ThZf3sfRdLd9O0oMGyIqjrlb0w3AMAdZxx8_nkmFhsdSRV3wdfSS0IybX-wKpKHaeaThF_i4M_ZRX2rqhR2qU7-pc3Fbh2s3DXicOmOnVm9C9pHwkxrOQFggks4QT_N2xUzrmX2t7e4Stgn4yJzPE4xs199mFMCFhekQrfbFK_gSNaMdMs1etvP6c_7XKdEhtpcPkg&redirect_url=%2Fmanifest.json net::ERR_FAILED 200 (OK)Understand this error
/list:1 <meta name="apple-mobile-web-app-capable" content="yes"> is deprecated. Please include <meta name="mobile-web-app-capable" content="yes">```
6. if i hit F5 to refresh a page e.g. /receipts I get `{"detail":"Not Found"}`on screen and `Failed to load resource: the server responded with a status of 404 ()` in console


