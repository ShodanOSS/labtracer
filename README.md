# LabTracer

LabTracer is a local tool to model a homelab. It is similar to Cisco Packet Tracer.

It has:

- A 3D topology view. This view shows the logical network.
- A 3D room view. This view shows racks, furniture and the physical location of each device.
- A properties panel for each device and each link.
- A device console with IOS-style commands.
- A simple network simulator for `ping` and `traceroute`.
- Config files for each device, with dated snapshots, diff and restore.
- Custom objects. You can make a new device type and import a `.glb` 3D model for it.

All data stays on your computer. The app does not connect to the internet.

## Requirements

- Python 3.8 or later. The server uses only the standard library.
- A current browser: Chrome, Edge or Firefox. WebGL must be on.
- Node.js is NOT necessary to run the app. It is necessary only to rebuild `app/app.js` from `src/`.

Target hardware: an 8th generation Intel Core i5 with 8 GB RAM and integrated graphics. The server uses approximately 20 MB of RAM. The browser tab uses approximately 200 to 300 MB (measured: 280 MB with software rendering, 6 MB of it JavaScript heap). The app does not draw frames when idle.

## Start the app

### Windows 10 or 11

1. Install Python 3 from python.org. Select "Add python.exe to PATH" during the installation.
2. Double-click `start.bat`.
3. The app opens in your default browser at `http://127.0.0.1:8765/`.

### Linux

1. Open a terminal in this folder.
2. Run `./start.sh`.
3. The app opens in your default browser at `http://127.0.0.1:8765/`.

### Options

| Option | Function |
|---|---|
| `--port 9000` | Use a different port. |
| `--no-browser` | Do not open a browser tab. |
| `--host 127.0.0.1` | Bind address. Keep the default. Other values make the app available on your network without authentication. |

To stop the server, push Ctrl+C in the terminal.

### Without Python

You can open `app/index.html` directly in the browser. In this mode, the app keeps labs in browser storage. Use File > Export lab to keep a copy on disk. "Export all configs" gives a `.tar` file in this mode.

## Where the data is

| Path | Contents |
|---|---|
| `data/labs/<name>.json` | One file for each lab. |
| `data/labs/.history/` | Older copies of each lab. The server keeps a copy at most every 10 minutes and keeps the last 40 copies. |
| `data/library.json` | Your custom objects (device templates). |
| `data/export/<lab>/<device>/` | Config files from File > Export all configs. |
| `data/monitor.json` | Agent address and token. Do not put this file in git. |

The `.gitignore` keeps the `data` folder out of git. Your labs, custom objects, exported configs and the agent token stay on your computer.

The lab files are JSON. You can keep them in git. Do not put secrets in the lab notes or config files.

## First start

On the first start, the app makes an example lab called `example-lab`. All names and addresses in it are placeholders. Edit it, or make a new lab with File > New lab.

## Views

- Topology view (key 1): the logical network. Device positions are free.
- Room view (key 2): the physical layout. Dimensions are in metres.

Mouse controls:

| Action | Result |
|---|---|
| Left drag on empty space | Orbit the camera. |
| Left drag on a device | Move the device. |
| Right drag | Pan. |
| Wheel | Zoom. |
| Click | Select a device or a link. |
| Double-click a device | Open its console. |

In the room view:

- Drag a device onto a desk or shelf. It moves to the surface height.
- Drag a rack-mount device (Rack U more than 0) onto a rack. It mounts in the highest free slot.
- Drag a rack-mounted device to move the full rack.
- Push R to turn the selected device 90 degrees.
- Select a rack and open the Physical tab to see the rack elevation. Click an empty U to mount a device there.

## Add devices

1. Find the device type in the left panel.
2. Drag it onto the canvas. Or click it, then click a location.

Room objects (racks, desks, shelves) go into the room view only. Virtual machines, containers and the Internet cloud go into the topology view only.

## Connect devices

1. Push L or click Link.
2. Optional: select a cable type in the list next to Link. "Auto" selects the type from the port kinds.
3. Click the first device. Select a port.
4. Click the second device. Select a port.
5. Push Esc to stop the link tool.

Select "New port…" in the port list to add a port to the device.

Each cable plugs into the position of its port on the 3D model. Switch, firewall and patch panel ports are on the front. Server, PC, NAS and router ports (network, iLO or BMC, console, power) are on the back, as on real equipment. Wireless links start at the top of the device. Tunnel and virtual links start at the centre. To join all cables at the device centre, turn off File > Settings > "Cables plug into their real port position".

## Move a cable

1. Click the cable in the view. Or open the Ports tab of a device and click the link name in the Link column.
2. In the link panel, find the end to move (End A or End B).
3. Select the new device in the Device list. The cable goes into the first free port on that device.
4. Select a different port in the Port list if necessary.

The other end stays connected. If the new device has no free port, add a port in its Ports tab first. Use Ctrl+Z to undo the move.

After you move a cable, examine the port settings on the new port. For example, a link to a switch that carries VLANs must be a trunk on both ends.

A port can have one link. Wireless ports and tunnel ports can have many links. For example, one AP radio serves many clients.

## Device properties

| Tab | Contents |
|---|---|
| General | Name, vendor, model, serial, colour, attributes, notes. "Bridges L2" makes the device a switch or bridge. "Routes IP" makes it a router. |
| Physical | Room, position, height, rotation, rack and U position, size. |
| Ports | Name, IP address (`A.B.C.D/NN`), switchport mode, VLAN, admin state, link. Click the arrow for more fields. |
| Routing | Static routes, live routing table, ping test, VLAN database. |
| Services | Services that run on the device. |
| Configs | Generated running-config and your own config files. |
| Console | IOS-style command line. |
| Monitor | What the check agent tests on this device, and the live results. |

### Port kinds

| Kind | Use |
|---|---|
| `eth`, `sfp` | Physical network ports. |
| `wifi` | Radio. Can have many wireless links. |
| `vport` | Virtual NIC or tap port, for example a VM on a hypervisor bridge. |
| `tunnel` | VPN interface, for example WireGuard `wg0`. Can have many tunnel links. |
| `svi` | VLAN interface (or Linux bridge) for the device's own IP on a VLAN. |
| `sub` | 802.1Q subinterface on a parent port. |
| `loop` | Loopback. |
| `console`, `usb`, `power` | Not part of the IP network. Power ports connect only to power ports. |

## Config files and snapshots

1. Select a device. Open the Configs tab.
2. "running-config" is generated from the device model. Click "Save as startup-config" to keep a dated copy.
3. Click "+ New" or "Import" to add a config file, for example `wg0.conf` or `netplan.yaml`.
4. Edit the text. Click "Snapshot" and type a note.
5. Click "diff" on a snapshot to compare it with the current text. Click "restore" to go back.

File > Export all configs writes every config to `data/export/<lab>/<device>/`.

## Console commands

Type `?` in a console for the full list. Abbreviations work (`sh run`, `conf t`, `int`, `no sh`, `wr`).

```
show running-config | interfaces | ip interface brief | ip route | vlan | neighbors | services | inventory
ping A.B.C.D
traceroute A.B.C.D
write memory
configure terminal
hostname NAME
interface NAME          (vlan10 = SVI, eth0.10 = subinterface, lo0, wg0, br0)
 ip address 192.168.10.10/24
 ip address 192.168.10.10 255.255.255.0
 switchport mode access | trunk | routed
 switchport access vlan 30
 switchport trunk native vlan 1
 switchport trunk allowed vlan 1,11,20-30
 shutdown | no shutdown
 description TEXT
vlan 30 name storage
ip route 0.0.0.0 0.0.0.0 192.168.10.1
ip route 0.0.0.0/0 wg0
ip default-gateway 192.168.10.1
ip routing | no ip routing
service NAME PORT
set ATTRIBUTE VALUE
```

Console changes go into the model immediately. Use Ctrl+Z to undo them.

## Network simulator

`ping` and `traceroute` trace the packet hop by hop. A green dot moves along the links when the ping succeeds. A red dot shows a failure, and the failed device label flashes.

The simulator checks:

- Access VLANs, trunk native VLANs and trunk allowed lists.
- Patch panel pass-through (port `12F` to port `12R`).
- Connected networks, static routes and longest prefix match.
- IP forwarding ("Routes IP") on each hop.
- The return path. A missing return route makes the ping fail.
- Shut down ports.

The simulator does NOT check firewall rules, NAT, ARP, STP, DHCP, link speed or the tunnel underlay. Use it to find layout and addressing errors, not policy errors.

## Live status

LabTracer can show live status from a small check agent. The agent pings each device and connects to its TCP service ports. Run the agent on a computer that is always on.

Green is up. Orange is degraded. Red is down. Grey is unknown.

To install and connect the agent, read `agent/README.md`.

Live status needs server.py. It is not available when you open `index.html` directly.

## Custom objects

1. Click "+ Custom object" in the left panel.
2. Type a name and a category.
3. Select a base shape and a front panel style. Set the size in metres.
4. For rack equipment, set Rack U (1U, 2U and so on).
5. Add port groups. Example: prefix `p`, start `1`, count `24`, kind `eth` gives `p1` to `p24`.
6. Optional: click "Import .glb model" to use your own 3D model. The model is scaled to the size you set.
7. Click "Add to library".

Other ways:

- Click the copy icon on a built-in type to start from it.
- Select a configured device. Click "Save as custom object" in the General tab.
- Use Import and Export in the left panel to share templates as JSON.

Use small, low-poly `.glb` files (less than 1 MB if possible). Large models make saves slow and use more RAM. The model is kept in `data/library.json`. If you share a lab file without the library, devices with a custom model show the base shape.

## Keyboard

| Key | Function |
|---|---|
| V | Select tool |
| L | Link tool |
| Esc | Stop the tool or clear the selection |
| Delete | Delete the selection |
| Ctrl+D | Duplicate the device |
| R, Shift+R | Turn 90 degrees (room view) |
| F | Fit the view |
| T | Top-down view |
| 1, 2 | Topology view, room view |
| Ctrl+Z, Ctrl+Y | Undo, redo |
| Ctrl+S | Save |
| Ctrl+O | Open a lab |

## Colours

To change the grid colour or the 3D background colour:

1. Open File > Settings.
2. Under Display, click the colour box for "Grid colour" or "3D background".
3. Select a colour. The view changes immediately.
4. Click "Reset" to go back to the default colour.

The settings are kept in the browser. The room floor stays dark. Only the grid lines use the grid colour.

## Performance on older PCs

The app draws a new frame only when something changes. It does not use the GPU when idle.

If the app is slow:

1. Open File > Settings.
2. Turn off "Smooth edges".
3. Set "Render resolution cap" to 1x or 0.75x.
4. Click "Reload now".

## Security

- The server listens on 127.0.0.1 only.
- The server refuses requests with a Host header that is not local. This stops DNS rebinding.
- Write requests must have the `X-LabTracer` header. A web page from a different origin cannot send it.
- File names are cleaned. The server cannot write outside the `data` folder.
- The server sends a Content Security Policy that blocks scripts from other origins.
- There is no authentication. Do not expose the port to a network.

## Git

The `.gitignore` ignores all files, then allows only the files of the app. This prevents accidental commits of personal data.

These items are never committed:

- The `data` folder: labs, lab history, custom objects, exported configs, agent address and token.
- `node_modules`.
- `agent/agent.json` and `agent/targets.json`.
- Certificates and keys (`*.pem`, `*.key`, `*.crt`, `*.p12`), `.env` files and files with `.local.` in the name.

To add a new file to git, add a `!/path` line to `.gitignore`.

Before you commit, do these checks:

1. Run `git status --ignored` and examine the lists.
2. Run `gitleaks detect --source .` (or `gitleaks git` on newer versions).

To keep your own labs in git, export them (File > Export lab) into a private repository.

## Rebuild from source

Do this only if you change files in `src/`.

1. Install Node.js 18 or later.
2. Run `npm install`.
3. Run `npm run build`. This writes `app/app.js`.
4. Optional: run `npm run dev` to rebuild on each change.

## Files

| Path | Contents |
|---|---|
| `server.py` | Local server and storage API. |
| `app/` | The built web app (`index.html`, `style.css`, `app.js`). |
| `src/main.js` | App state, undo, save, tools, keyboard. |
| `src/viewport.js` | Three.js views, picking, dragging, packet animation. |
| `src/models3d.js` | Procedural 3D models and front panel textures. |
| `src/inspector.js` | Properties panel. |
| `src/palette.js` | Device library and custom object editor. |
| `src/cli.js` | Console commands and running-config generator. |
| `src/netsim.js` | Network simulator. |
| `src/model.js` | Lab data model. |
| `src/templates.js` | Built-in device types. |
| `src/sample.js` | Example lab (placeholder names and addresses). |
| `src/store.js` | Storage (server or browser). |
| `src/monitor.js` | Live status from the check agent. |
| `agent/` | The check agent, its systemd unit and its instructions. |

Three.js (MIT licence) is bundled into `app/app.js`.
