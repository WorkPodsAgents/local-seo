# Remote code

For the **Privacy practices** tab, **Are you using remote code?**: **No, I am not using remote
code.**

All JavaScript the extension runs is in the uploaded package: the service worker, the side panel,
the report page, the offscreen document and the content scripts it injects. It loads no script
from a server, has no `eval` or `new Function`, and loads no WebAssembly. The fonts are bundled.
Responses from DataForSEO, Cloro and the model providers are JSON data that is displayed or
checked, never run.
