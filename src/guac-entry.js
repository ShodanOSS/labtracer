// Built into app/guac.js (Apache Guacamole client, Apache-2.0). Loaded only when a remote
// session opens (src/remote.js), so app/app.js does not grow.
import Guacamole from 'guacamole-common-js';

window.Guacamole = Guacamole;
