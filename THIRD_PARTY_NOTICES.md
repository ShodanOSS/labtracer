# Third-party notices

LabTracer is licensed under the Apache License 2.0 (see `LICENSE` and `NOTICE`).
The prebuilt files in `app/` include third-party code. This file lists each one with its license.

## Bundled in the shipped files

| Component | Version | License | Shipped in |
|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) (incl. `examples/jsm` OrbitControls, GLTFLoader, CSS2DRenderer) | 0.170.0 | MIT | `app/app.js` |
| [xterm.js](https://github.com/xtermjs/xterm.js) (`@xterm/xterm`) | 5.5.0 | MIT | `app/app.js`, `app/app.css` |
| [@xterm/addon-fit](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit) | 0.10.0 | MIT | `app/app.js` |
| [Apache Guacamole client](https://guacamole.apache.org/) (`guacamole-common-js`, npm repackaging of the ASF source) | 1.5.0 | Apache-2.0 | `app/guac.js` |

## Used but not distributed

LabTracer does not ship these components. You install or run them yourself.

| Component | License | How LabTracer uses it |
|---|---|---|
| [paramiko](https://www.paramiko.org/) | LGPL-2.1 | Optional Python library, installed with `pip install paramiko`. It runs the SSH console, collect, push and discovery. |
| [pywinpty](https://github.com/andfoy/pywinpty) | MIT | Optional Python library (Windows, "System ssh" engine) |
| guacd ([guacamole-server](https://github.com/apache/guacamole-server)) | Apache-2.0 | A separate process or container, reached over TCP |
| OpenSSH client, `ping`, `arp` | various | Separate operating-system programs |
| Monitoring systems (Nagios, Naemon, Icinga, Checkmk, Prometheus, Zabbix, LibreNMS) | various | Separate systems, reached over HTTP or through their status files |

Tools used only for building and testing (esbuild: MIT; puppeteer-core: Apache-2.0) are not part of the shipped files.

---

## three.js — MIT

```
The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## xterm.js — MIT

```
Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## @xterm/addon-fit — MIT

```
Copyright (c) 2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Apache Guacamole client (guacamole-common-js) — Apache-2.0

Licensed under the Apache License, Version 2.0. The full text is in `LICENSE` in this repository.
The upstream notice for Apache Guacamole is reproduced in `NOTICE`.
