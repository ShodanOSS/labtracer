// SPDX-License-Identifier: Apache-2.0
/*! Apache Guacamole client (guacamole-common-js 1.5.0)
 * Copyright 2020 The Apache Software Foundation
 * This product includes software developed at The Apache Software Foundation (https://www.apache.org/).
 * Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0
 * @license Apache-2.0 */
// Built into app/guac.js (Apache Guacamole client, Apache-2.0). Loaded only when a remote
// session opens (src/remote.js), so app/app.js does not grow.
import Guacamole from 'guacamole-common-js';

window.Guacamole = Guacamole;
