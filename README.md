# LabTracer

LabTracer is a local tool to model a homelab. It is similar to Cisco Packet Tracer.

It has:

- A 3D topology view. This view shows the logical network.
- A 3D room view. This view shows racks, furniture and the physical location of each device.
- A properties panel for each device and each link.
- A device console with IOS-style commands.
- A real SSH console to the device (optional, needs server.py).
- A simple network simulator for `ping` and `traceroute`.
- Config files for each device, with dated snapshots, diff and restore.
- Custom objects. You can make a new device type and import a `.glb` 3D model for it.
- An inventory table with status, asset tag, purchase date, supplier, cost and warranty, and CSV import and export.
- Drift: LabTracer reads the real devices over SSH and shows how they differ from the model. You can accept a difference into the model, or push the model to the device.
- Discovery: LabTracer sweeps address ranges, reads the devices it can log in to, follows LLDP/CDP and ARP tables, and adds what it finds to the lab, with ports, addresses and cables.
- Push to Cisco IOS, Linux (ifupdown, Proxmox, NetworkManager, netplan) and MikroTik RouterOS, with the change made persistent, a backup before each change, a rollback timer on the device, and restore.
- Change sets: stage changes for many devices, review them together, apply them in order. Every change goes into an audit log that shows tampering.
- Live status from a small check agent, from Nagios (through the agent), or from Prometheus, Zabbix, Icinga 2 or LibreNMS. LabTracer can also export a Nagios config from the lab.
- Remote access: RDP, VNC, SSH and Telnet in a window of the app, over Apache Guacamole (guacd only, no Guacamole web app).

All data stays on your computer. The app does not connect to the internet. The SSH console, Collect, Push, Discovery and remote sessions connect only to the devices and address ranges that you select.

## Contents

- [Requirements](#requirements) · [Start the app](#start-the-app) · [Where the data is](#where-the-data-is) · [First start](#first-start)
- Model the lab: [Views](#views) · [Add devices](#add-devices) · [Connect devices](#connect-devices) · [Wall ports](#wall-ports) · [Cable routes](#cable-routes) · [Move a cable](#move-a-cable) · [Wireless](#wireless-ssids-and-iot-devices) · [Inventory](#inventory) · [Device properties](#device-properties)
- Configs and consoles: [Config files](#config-files-and-snapshots) · [Console commands](#console-commands) · [SSH console](#ssh-console) · [Network simulator](#network-simulator)
- Real devices: [Live status](#live-status) · [Nagios](#nagios) · [Other monitoring systems](#other-monitoring-systems) · [Discover a network](#discover-a-network) · [Drift](#drift-model-vs-device) · [Push](#push-the-model-to-a-device) · [Change sets and audit log](#change-sets-and-audit-log) · [Backups and recovery](#backups-and-recovery) · [Remote access](#remote-access-guacamole)
- Other: [Custom objects](#custom-objects) · [Keyboard](#keyboard) · [Colours](#colours) · [Performance](#performance-on-older-pcs) · [Security](#security) · [Git](#git)
- Development: [Rebuild from source](#rebuild-from-source) · [Change the lab format](#change-the-lab-format) · [Tests](#tests) · [Files](#files)

## Requirements

- Python 3.8 or later. The server uses only the standard library.
- A current browser: Chrome, Edge or Firefox. WebGL must be on.
- Optional, for the SSH console and for Collect, Push and Discovery: `pip install paramiko`. For the System ssh engine of the SSH console on Windows: `pip install pywinpty`.
- Optional, for remote access (RDP, VNC): guacd, the Apache Guacamole server daemon. For example `docker run -d -p 127.0.0.1:4822:4822 guacamole/guacd`, or the `guacd` package of your Linux distribution.
- Node.js is NOT necessary to run the app. It is necessary only to rebuild `app/app.js` from `src/`.

Target hardware: an 8th generation Intel Core i5 with 8 GB RAM and integrated graphics. The server uses approximately 35 MB of RAM, and approximately 50 MB after you first open an SSH console (paramiko loads then). The browser tab uses approximately 200 to 300 MB (measured: 280 MB with software rendering, 6 MB of it JavaScript heap). The app does not draw frames when idle.

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
| `data/.history/` | Copies of `library.json` from before a format upgrade. |
| `data/export/<lab>/<device>/` | Config files from File > Export all configs. |
| `data/monitor.json` | Agent address and token. Do not put this file in git. |
| `data/ssh/known_hosts` | Host keys that you trusted in the SSH console (paramiko engine) or in Collect. |
| `data/observed/<lab>/` | What Collect read from each device (facts and config), for the drift report. |
| `data/discovery/<lab>.json` | The last discovery result of the lab. |
| `data/changes/<lab>/` | Change sets: staged, applied and discarded, with each device's result. |
| `data/backups/<lab>/<device>/` | The config of a device from before each change LabTracer applied. |
| `data/audit/<lab>.jsonl` | The audit log: every change, backup, rollback, restore, discovery and remote session. |
| `data/remote.json` | The guacd address for remote access. |

If the same lab is open in two browser windows or tabs, a window cannot silently overwrite the other window's saved changes. Autosave stops in the window with the older version, and Ctrl+S asks which version to keep. If you replace the other version, a copy of it goes into `data/labs/.history/`.

### Files from other LabTracer versions

Each lab file and `library.json` has a format version (`"version"` in the file).

- A file from an older LabTracer opens normally. LabTracer upgrades it in memory and tells you. The first save keeps a copy of the old file: labs in `data/labs/.history/`, the library in `data/.history/`. In browser storage mode, the copy shows in File > Open lab as `<name>.format1-backup`.
- A file from a newer LabTracer does not open. Update LabTracer. LabTracer never writes over it: the server also refuses a save in an older format, for example from a browser tab that was open while you updated the app. Reload that tab.

Undo and redo history lives only in the browser tab. It is not saved, and it is gone when you reload the page or stop the server.

The `.gitignore` keeps the `data` folder out of git. Your labs, custom objects, exported configs, device backups, the audit log and all tokens stay on your computer.

The lab files are JSON. You can keep them in git. Do not put secrets in the lab notes or config files.

## First start

On the first start, the app makes an example lab called `example-lab`. All names and addresses in it are placeholders. Edit it, or make a new lab with File > New lab.

## Views

- Topology view (key 1): the logical network. Device positions are free.
- Room view (key 2): the physical layout. Dimensions are in metres.
- Inventory (key 3): a table of all items. Refer to [Inventory](#inventory).

Mouse controls:

| Action | Result |
|---|---|
| Left drag on empty space | Orbit the camera. |
| Left drag on a device | Move the device. |
| Right drag | Pan. |
| Wheel | Zoom. |
| Click | Select a device or a link. |
| Double-click a device | Open its console. |
| Click the bar beside a side panel | Hide or show the panel. |
| Drag the bar beside a side panel | Make the panel wider or narrower. Drag it almost to the edge to hide it. |

The left panel (device library) and the right panel (properties) can be hidden, to give the 3D view more space. Click the bar between the panel and the view. A hidden panel leaves a narrow bar with an arrow: click it to show the panel again. Keys `[` and `]` do the same. The widths and hidden panels are kept in the browser. Double-click a device to open its console: this also shows the properties panel if it is hidden.

In the room view:

- Drag a device onto a desk or shelf. It moves to the surface height.
- Drag a rack-mount device (Rack U more than 0) onto a rack. It mounts in the highest free slot.
- Drag a rack-mounted device to move the full rack.
- Push R to turn the selected device 90 degrees.
- Select a rack and open the Physical tab to see the rack elevation. Click an empty U to mount a device there.

## Add devices

1. Find the device type in the left panel.
2. Drag it onto the canvas. Or click it, then click a location.

Room objects (racks: 42U, half rack 24U, wall rack 12U; desks, shelves) go into the room view only. Virtual machines, containers and the Internet cloud go into the topology view only.

## Connect devices

1. Push L or click Link.
2. Optional: select a cable type in the list next to Link. "Auto" selects the type from the port kinds.
3. Click the first device. Select a port.
4. Click the second device. Select a port.
5. Push Esc to stop the link tool.

Select "New port…" in the port list to add a port to the device.

Each cable plugs into the position of its port on the 3D model. Switch, firewall and patch panel ports are on the front. Server, PC, NAS and router ports (network, iLO or BMC, console, power) are on the back, as on real equipment. Wireless links start at the top of the device. Tunnel and virtual links start at the centre. To join all cables at the device centre, turn off File > Settings > "Cables plug into their real port position".

## Wall ports

Wall ports (single or double, in Infrastructure) work like a small patch panel. The front jack `1F` is in the room. The rear jack `1R` is the cable in the wall. Link the device to `1F`, and link `1R` to the switch (for example the unmanaged switch). The simulator passes traffic from `1F` to `1R`.

In the room view, a wall port snaps to the nearest wall when you drop it, and faces into the room. Any other device (for example a TV) can do the same: open its Physical tab and turn on "Mounted on a wall".

## Cable routes

In the room view, cables can hang or follow the room:

| Route | Result |
|---|---|
| Hanging (gravity) | The cable sags between the two ports. |
| Along the floor | Down to the floor, along the floor, up to the other port. |
| Clipped to walls | Down to the floor, to the nearest wall, along the skirting board (around corners), and back out. |
| Ceiling tray | Up to a tray below the ceiling, across, and down. |

Set the default for the lab in the lab panel (click empty space): "Cable routing in the room view". To change one cable, select it and set "Cable route (room view)". Cables inside one rack and leads shorter than 0.5 m always hang. Parallel cables are spread a little, so they show as a bundle.

The link panel shows the cable length as drawn in the room view. Use it to choose the cable length to buy (add some slack).

## Move a cable

1. Click the cable in the view. Or open the Ports tab of a device and click the link name in the Link column.
2. In the link panel, find the end to move (End A or End B).
3. Select the new device in the Device list. The cable goes into the first free port on that device.
4. Select a different port in the Port list if necessary.

The other end stays connected. If the new device has no free port, add a port in its Ports tab first. Use Ctrl+Z to undo the move.

After you move a cable, examine the port settings on the new port. For example, a link to a switch that carries VLANs must be a trunk on both ends.

A port can have one link. Wireless ports and tunnel ports can have many links. For example, one AP radio serves many clients.

## Wireless, SSIDs and IoT devices

An access point (or a router with a wifi port and "Bridges L2" on) can broadcast SSIDs. Each SSID puts its clients on one VLAN.

1. Select the access point. Open the Routing tab.
2. Under "Wireless SSIDs", click "+ SSID". Set the name, the VLAN and the security.
3. Make sure that the uplink of the access point carries that VLAN (trunk).
4. Link a wifi client (for example a device from the IoT group in the left panel) to a radio port of the access point. The client joins the first SSID.
5. To change the SSID, select the wireless link and change "SSID on …". Or open the Ports tab of the client, expand its wifi port and set "Joins SSID".

All radios of the access point broadcast all its SSIDs. The topology view shows the SSID on each wireless link. `show wlan` in the console lists the SSIDs and their clients.

If an access point has no SSIDs, its clients use the access VLAN of the radio port (older labs work this way).

## Inventory

Click "Inventory" in the toolbar, or push 3. The inventory shows all items of the lab in a table.

- Click a column name to sort. Click it again to reverse the order.
- Type in the search box to find items by name, serial, asset tag, address, MAC, location, notes or attributes.
- Use the lists to show one status, one category or one room. "Not in a room" shows items that have no room.
- Click a row to edit the item in the panel on the right. Double-click a row to show the item in the 3D view.
- The line above the table shows the number of items in each status, the total cost and the warranties that ended or end within 90 days. Click a number to show only those items.
- Columns that are empty for all items shown (for example Serial) are not shown.

### Status

Set the status in the Inventory section of the General tab.

| Status | Drawn in the 3D views | Checked for live status |
|---|---|---|
| In service | Yes | Yes |
| Faulty / in repair | Yes | Yes |
| Spare | No | No |
| On order | No | No |
| Retired | No | No |

To show spare, on-order and retired items in the 3D views, open File > Settings and select "Show spare, on-order and retired items in the 3D views". The links of an item that is not drawn are not drawn either.

Use "Storage location" for items that are not in a room or a rack, for example "garage shelf, box 3".

### Add items

- Click "+ Add item". Select the type, the name and the status.
- Or, in the inventory, click a type in the left panel. The item is added immediately.
- For spare parts, cables, drives and other items that are not network devices, use the "Parts" group. These items have no ports and are not in the topology view.

### Import from a CSV file

1. Click "Import CSV…" (or File > Import inventory).
2. Select the file. The first row must have the column names. Comma, semicolon and tab separators are accepted.
3. Examine the preview. It shows the number of new and updated items and a warning for each value that LabTracer did not accept.
4. Click "Import". Push Ctrl+Z to undo the import.

Rules:

- A row updates the item with the same name. If the name is empty, it updates the item with the same serial. Clear "Update items that already exist" to add only new items.
- An empty cell does not change the value that is already there.
- LabTracer finds the columns by their names. For example, "Hostname", "Manufacturer", "Serial Number", "Price" and "Warranty Expires" are accepted. A column with an unknown name becomes an attribute.
- Dates must be year first: `2024-03-05` or `2024/3/5`. LabTracer does not guess the order of `05/03/2024`; it shows a warning.
- Costs can have a currency symbol and thousands separators: `$1,234.50` and `1.234,50 €` are both 1234.50.
- Status words such as "in use", "broken", "stock", "on order" and "decommissioned" are accepted.
- "addresses" takes `eth0=192.168.1.10/24 eth1=…` or a single address. "services" takes `ssh:22; https:443`.
- "room", "rack" and "U" place the item. A new item with a rack becomes 1U rack equipment. If the U is not free, the item goes into the first free U.
- A new item gets its type from the "template" column, a custom object with the same model, or the category. Other items become a generic part.

File > Export inventory (.csv) exports all items, in the same format. "Export CSV" in the inventory exports only the items that the table shows. You can edit the file in a spreadsheet and import it again.

## Device properties

| Tab | Contents |
|---|---|
| General | Name, vendor, model, serial, colour, inventory fields, attributes, notes. "Bridges L2" makes the device a switch or bridge. "Routes IP" makes it a router. |
| Physical | Room, position, height, rotation, rack and U position, size. |
| Ports | Name, IP address (`A.B.C.D/NN`), switchport mode, VLAN, admin state, link. Click the arrow for more fields. |
| Routing | Static routes, live routing table, ping test, VLAN database. |
| Services | Services that run on the device. |
| Configs | Generated running-config and your own config files. |
| Console | IOS-style command line (Simulated), a real SSH session to the device (SSH), or a remote desktop or terminal over Guacamole (Remote). |
| Monitor | What the check agent tests on this device, and the live results (from the agent, Nagios or a monitoring system). |
| Drift | How the real device differs from the model (see [Drift](#drift-model-vs-device)): accept, push or stage each difference; **Backups** and **Audit** for this device. |

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
| `console`, `usb`, `video`, `power` | Not part of the IP network. Power ports connect only to power ports, video ports (HDMI, DisplayPort) only to video ports. |

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
show running-config | interfaces | ip interface brief | ip route | vlan | wlan | neighbors | services | inventory
ping A.B.C.D
traceroute A.B.C.D
write memory
configure terminal
hostname NAME
interface NAME          (an existing port, or a new vlan10 = SVI, eth0.10 = subinterface, lo0, wg0, br0;
                         add physical ports in the Ports tab)
 ip address 192.168.10.10/24
 ip address 192.168.10.10 255.255.255.0
 switchport mode access | trunk | routed
 switchport access vlan 30
 switchport trunk native vlan 1
 switchport trunk allowed vlan 1,11,20-30
 ssid home-iot           (wifi client: join an SSID)
 shutdown | no shutdown
 description TEXT
vlan 30 name storage
ip route 0.0.0.0 0.0.0.0 192.168.10.1
ip route 0.0.0.0/0 wg0
ip default-gateway 192.168.10.1
ip routing | no ip routing
wlan ssid NAME vlan 50 security wpa2   (access point; no wlan ssid NAME)
service NAME PORT
set ATTRIBUTE VALUE
```

Console changes go into the model immediately. Use Ctrl+Z to undo them.

## SSH console

The SSH mode of the Console tab opens a real SSH session to the device. server.py makes the SSH connection and relays the terminal to the browser:

```
browser (terminal)  <-- WebSocket -->  server.py  <-- SSH -->  device
```

### Install

| Engine | Install | Notes |
|---|---|---|
| paramiko (default) | `pip install paramiko` | Uses your keys in `~/.ssh` and ssh-agent. Does not read `~/.ssh/config`. |
| System ssh | Nothing on Linux. On Windows: `pip install pywinpty`. | Uses the OpenSSH client of the computer, with your `~/.ssh/config`, `known_hosts`, ProxyJump and ssh-agent. |

Restart server.py after the installation. To set the default engine, open File > Settings > "Default SSH engine". A device can use a different engine.

### Connect

1. Select the device. Open the Console tab.
2. Click "SSH".
3. Set the fields:
   - Host. If you keep it empty, LabTracer uses the address of the Monitor tab, or the first IP address in the Ports tab.
   - Port and User. If you keep User empty, LabTracer uses your local user name.
   - Engine.
   - Key file (optional), for example `~/.ssh/id_ed25519`. If you keep it empty, LabTracer uses ssh-agent and the default keys in `~/.ssh`.
4. Click "Connect".
5. On the first connection with paramiko, LabTracer shows the fingerprint of the host key. Compare it with the fingerprint on the device. Click "Trust and connect" only if they are the same. The key goes into `data/ssh/known_hosts`. The System ssh engine asks the same question in the terminal and uses your OpenSSH `known_hosts`.

If the host key of a device changes, LabTracer refuses the connection. If the change is expected (for example, you installed the device again), remove the old line from `data/ssh/known_hosts` or from `~/.ssh/known_hosts`.

The session stays open when you select a different device or tab. "SSH ●" shows an open session. The session closes when you click "Disconnect", delete the device, open a different lab, close the browser tab, or after 30 minutes without activity. At most 8 sessions can be open.

If paramiko finds no keys, no ssh-agent or no `known_hosts` file, the terminal shows a message. Set a key file, or use the System ssh engine.

### Password login (not recommended)

Use keys if possible. Some legacy devices have no key-based login. For these devices only:

1. Set "Login" to "Password (not recommended)".
2. Click "Connect". With paramiko, a dialog asks for the password. With System ssh, the terminal asks for it.

LabTracer never saves the password. It is not in the lab file, in the browser storage or in the `data` folder.

### Legacy devices

Old devices can use algorithms that are off by default: `ssh-rsa`, SHA-1 key exchange (`diffie-hellman-group1-sha1`, `diffie-hellman-group14-sha1`) and CBC ciphers. To use them:

1. Select "Allow legacy algorithms".
2. Set the engine to "System ssh".

paramiko 5 and later have no SHA-1 key exchange and no `ssh-rsa`. Thus, for legacy devices, use the System ssh engine. Collect and Push use only paramiko, so with paramiko 5 or later they cannot connect to a device that needs SHA-1 key exchange.

The SSH console is not available when you open `index.html` directly, or when server.py listens on a network address (`--host`).

## Network simulator

`ping` and `traceroute` trace the packet hop by hop. A green dot moves along the links when the ping succeeds. A red dot shows a failure, and the failed device label flashes.

The simulator checks:

- Access VLANs, trunk native VLANs and trunk allowed lists.
- Patch panel pass-through (port `12F` to port `12R`).
- Connected networks, static routes and longest prefix match.
- IP forwarding ("Routes IP") on each hop.
- The return path. A missing return route makes the ping fail.
- Shut down ports.
- SSIDs. A wireless client lands on the VLAN of its SSID. A client on an SSID that the access point does not have gets no connection.

The simulator does NOT check firewall rules, NAT, ARP, STP, DHCP, link speed or the tunnel underlay. Use it to find layout and addressing errors, not policy errors.

## Live status

LabTracer can show live status from a small check agent. The agent pings each device and connects to its TCP service ports. Run the agent on a computer that is always on. Instead of its own checks, the agent can pass on the results of [Nagios](#nagios). LabTracer can also read the results of [Prometheus, Zabbix, Icinga 2 or LibreNMS](#other-monitoring-systems) directly.

Green is up. Orange is degraded. Red is down. Grey is unknown.

To install and connect the agent, read `agent/README.md`.

Live status needs server.py. It is not available when you open `index.html` directly.

server.py polls the agent (or the monitoring system) once for all open LabTracer windows and pushes the results to them over a WebSocket (`/api/events`). If that connection drops, each window polls server.py until it is back.

### Nagios

LabTracer can make a Nagios config from the lab, and show the results of Nagios instead of the agent's own checks.

- In the lab panel, the **Nagios** section exports `labtracer-<lab>.cfg`: one host for each device that the agent would check, with its service checks, hostgroups (category, room, subnet) and host parents.
- Set **Nagios runs on** to the device that runs Nagios. The parents then follow the cables from that device, through devices without an address (unmanaged switches, patch panels). So Nagios reports a device behind a failed switch as UNREACHABLE, not as DOWN. A VM without cables hangs off the device in its Host attribute.
- **Preview** shows the file. It also lists the devices that are skipped (no address) or not cabled to the Nagios server.
- With the agent's Nagios source, the Monitor tab shows each Nagios check, and the lab panel lists the hosts that are in Nagios but not in the lab, and the reverse.

To set up Nagios and the agent, read "Use Nagios" in `agent/README.md`.

### Other monitoring systems

LabTracer can also show the results of a monitoring system you already run. In the lab panel, under **Monitoring**, set **Status from**:

| Status from | URL | Login | What LabTracer reads |
|---|---|---|---|
| LabTracer agent | `http://host:8766` | agent token | The agent's ping and TCP checks, or Nagios results (agent source "nagios"). |
| Prometheus | `http://prometheus:9090` | none, a bearer token, or user and password | `up` and `probe_success` (blackbox exporter) per instance. |
| Zabbix (5.4 or later) | `https://zabbix.example/zabbix` | API token | Host availability and open problems. |
| Icinga 2 | `https://icinga:5665` | API user and password | Host and service states. |
| LibreNMS | `http://librenms` | API token | Device status and open alerts. |

Click **Test**, then **Start live**. LabTracer matches each monitored host to a lab device by the monitor address of the device (Monitor tab), then by name (without the domain). The lab panel shows how many hosts it matched. A device is up when all its checks are OK, degraded when some fail, and down when the host itself is down. LabTracer only reads: it never changes the monitoring system. For HTTPS with your own CA, set the CA file; "Skip TLS certificate check" is for tests only.

server.py reads the monitoring system once for all open windows, like the agent. The token or password is kept in `data/monitor.json`.

## Discover a network

Discovery finds the devices of a network that the lab does not have yet, and adds them.

1. Click an empty area of the 3D view. In the lab panel, under **Discover network**, click **Discover…**.
2. Type the addresses to sweep: subnets, ranges and single addresses, separated by commas (`192.168.1.0/24, 10.0.0.1-50, 10.0.5.7`). At most 4096 addresses in one run.
3. Optional: an SSH user and key (or password) to read the devices. Without them, LabTracer finds hosts and open ports only.
4. Optional: **Crawl**. LabTracer then also sweeps the management addresses of LLDP/CDP neighbors and the addresses in the ARP tables of the devices it read (private addresses only), and, with the second box, their connected subnets (/22 or smaller).
5. Click **Start**. The lab panel shows the progress. Then the results open.
6. In the results, clear the hosts you do not want, check the names and types, and click **Add to the lab**.

What discovery does:

| Step | How |
|---|---|
| Find hosts | TCP connect to common ports (22, 80, 443, 445, 3389, 53, 23, 8006, 8291, 8080); a refused connection also counts. Then a ping, then this PC's ARP cache (finds hosts on the local subnet that block every port). No raw sockets, no root. |
| Open ports | A longer port list on each host found (printers, cameras, NAS, MQTT, VNC and others). |
| Names and MACs | Reverse DNS. MACs from this PC's ARP cache and from the ARP tables of the devices read. |
| Read devices | Hosts with SSH open are read with the same drivers as Collect (Linux, Cisco IOS, RouterOS). |
| Type | From what was read (switch, router, hypervisor, NAS, Raspberry Pi) or from the open ports (printer, camera, Windows PC, smart home hub). You can change it in the results. |

What **Add to the lab** makes: a device for each host, placed in rows in the topology view (routers, switches, servers, others); ports, addresses, VLANs, static routes, services and Proxmox VMs from what was read; SSH settings, so Collect works at once; and cables:

- from LLDP and CDP neighbors;
- from switch MAC tables: an access port (not a trunk) without LLDP/CDP neighbor that learned the MAC of one known device is cabled to it. When it learned the MACs of several known devices, LabTracer adds an unmanaged switch between them (a note on the device says so).

The facts of the devices read become their drift facts, so the Drift tab works at once. Hosts that are already in the lab (same address, MAC or name) are not added again. Ctrl+Z removes everything that **Add to the lab** added.

New host keys: by default the results list them, with **Trust N host key(s)…** to compare the fingerprints and read those hosts again. **Trust the host key of devices seen for the first time** saves them without asking (each is logged).

Discovery is read-only, like Collect. The last result is in `data/discovery/<lab>.json`.

## Drift: model vs device

The lab is the plan. Collect reads the real device over SSH and lists each difference: addresses, interfaces, switchport modes and VLANs, static routes, cabling (LLDP or CDP neighbors), open TCP ports, Proxmox VMs and containers, and inventory facts (vendor, model, serial, MAC, OS).

Collect is read-only on the device. It runs `show` commands, `ip`, `ss`, `lldpctl`, `pvesh` and RouterOS `print` and `export`. Only **Push** changes a device, and only after you review the commands.

| Platform | Driver | Collect | Push |
|---|---|---|---|
| Linux, Proxmox VE, Raspberry Pi | `linux` | For neighbors, install `lldpd`. Proxmox guests and the serial number need root. | Apply, persistent (see below). Needs root or `sudo` without a password. |
| DD-WRT and other BusyBox systems | `linux` | Reads `ifconfig`, `route -n` and `nvram`. | Send to console. |
| Cisco IOS and IOS-XE | `ios` | `show running-config` needs privilege 15 (the prompt must end with `#`). | Apply; `write memory` after the confirmation. |
| MikroTik RouterOS 6 and 7 | `routeros` | Exec commands (`print terse`, `export terse`). | Apply (addresses, routes, interfaces, names). Switch ports and VLANs: console. |
| Windows, OPNsense, UniFi | — | Planned. "Detect" names them and says they are not supported yet. | — |

1. Set up SSH in the Console tab of the device (host, user, key). Collect uses the same settings and the same `data/ssh/known_hosts`. Collect and Push always use the paramiko engine, also when the console uses System ssh. They do not read `~/.ssh/config`, so set the host, user and key file in the Console tab.
2. Open the Drift tab and click **Collect now**. To read every device with SSH settings, click **Collect all** in the lab panel (click an empty area of the 3D view).
3. For each difference, choose:
   - **Accept**: change the model to match the device. Ctrl+Z undoes it.
   - **Push**: change the device to match the model (see below).
   - **Stage**: add the push to a change set, to apply it later with changes on other devices (see [Change sets](#change-sets-and-audit-log)).
   - **Ignore** (×): hide a difference you expect.

### Push the model to a device

**Push** on an item (or **push all**) shows the commands that make the device match the model, and the file changes for Linux. Nothing runs until you choose:

- **Apply**: see below.
- **Stage**: add it to the change set.
- **Send to console** (all platforms): opens the SSH console of the device and pastes the commands without pressing Enter. Check them, then press Enter.
- **Copy**: copies the commands.

**Apply** runs these steps, and writes each of them to the audit log:

1. **Backup.** LabTracer reads the device's config and keeps it (Drift tab › **Backups**). Where possible, it also keeps a copy on the device: `flash:lt-<id>.cfg` (IOS), `lt-<id>.backup` (RouterOS), `/var/backups/labtracer/<id>.tgz` (Linux).
2. **Rollback timer** (when you set minutes): the device goes back to its old config by itself, unless LabTracer confirms the change in time.
3. **Commands.** Exactly the reviewed commands. LabTracer stops at the first one that fails.
4. **Check.** LabTracer connects again. If it can not, and the timer is on, the device rolls back by itself; the result says "rolls back by itself within N min".
5. **Confirm**, or **restore**: when a command failed, LabTracer puts the backup back (clear "If the device refuses a command, put the backup back" to leave it as it is).
6. **Save** (IOS): `write memory`, only after the confirmation.
7. **Collect again**, so the drift report shows the result.

How each platform keeps the change, and how it rolls back:

| Platform | Persistent change | Rollback timer | Restore a backup |
|---|---|---|---|
| Cisco IOS | `write memory` after the confirmation. | With `archive` configured: `configure terminal revert timer N`, confirmed with `configure confirm`. Without: `reload in N` (the device restarts with its startup-config, which LabTracer does not change before the confirmation), cancelled with `reload cancel`. | `configure replace flash:lt-<id>.cfg force` |
| Linux, ifupdown / ifupdown2 (Debian, Proxmox) | LabTracer edits `/etc/network/interfaces` (you see the diff); ifupdown2 applies it with `ifreload -a`, classic ifupdown also gets `ip` commands. LabTracer refuses to write when the file changed since the last collect. | A `systemd-run` timer runs a script that unpacks the backup, undoes the `ip` commands and reloads the network config. Confirmed with `systemctl stop`. | Unpacks the backup and reloads ifupdown2, netplan and NetworkManager. |
| Linux, NetworkManager | `nmcli connection modify`, then `nmcli device reapply` (or `connection up` / `down`). | Same timer. | Same. |
| Linux, netplan | `netplan set`, then `netplan apply`. Needs netplan 0.101 or later. | Same timer. | Same; netplan files added since the backup are removed. |
| Linux, none of these | `ip` commands only; a note says that they are lost at the next reboot. | Same timer. | Same. |
| MikroTik RouterOS | RouterOS keeps each change as soon as it accepts it. | A script that waits, then loads the backup (the router reboots). Confirmed by removing the script. | `/system backup load` (the router reboots). |

For Linux, LabTracer must know how the host keeps its network config: collect the device once (with the current LabTracer) before a push. The commands start with `sudo -n` unless you log in as root; `sudo` must not ask for a password.

⚠ marks a push that can cut your connection to the device: a changed or removed address, a shutdown, a trunk or switchport mode change, a deleted VLAN or a default route. **push all** leaves these out. For these, the rollback timer is on by default (5 minutes). Make sure you can reach the device another way (console cable, another address).

The browser never sends command text to server.py. It sends operations (for example "access VLAN 20 on Gi0/3"). server.py checks every value, the driver writes the commands, and Apply runs only the reviewed list, once, within 10 minutes.

The platform support for Push was tested on recorded and simulated device output (see the tests). Try a push on one device of each kind before you use it on many.

### Scheduled collect

In the lab panel, set **Collect again every … minutes**. It reads the devices with key login while LabTracer is open. Devices with password login, and devices with a host key you have not confirmed yet, wait for a manual Collect.

Labels in the 3D view show `Δ` and the number of errors and warnings. The Inventory view gets a Verified column with the date of the last collect (✓ when the serial matches).

**Fill in inventory facts automatically** (lab panel) accepts vendor, model, serial, MAC and OS after each collect.

**Compare config** shows the config that LabTracer generates from the model next to the config read from the device. **Save config to Configs** keeps a dated copy in the Configs tab.

What the device reported is kept in `data/observed/<lab>/`, apart from the lab file. Drift needs server.py. It is not available when you open `index.html` directly.

## Change sets and audit log

A change set collects pushes for many devices, so you can review them as one change and apply them in a planned order.

1. In the Drift tab of a device, click **stage** on a difference (or **stage all**, or **Stage** in the push review). The first stage starts a change set. The Drift tab shows "N staged".
2. Stage changes on other devices. A second stage for the same device adds to its item.
3. In the lab panel, under **Changes and audit**, click **Review and apply**. The review shows, for each device in order, the changes, the commands, the file diffs and the notes. You can:
   - give the change a title and a note (why, ticket, maintenance window);
   - move a device up or down (for example: change the access switches first, the core switch last);
   - remove a change or a device;
   - set the rollback timer, what to do when a device refuses a command, and **Stop at the first device that fails**;
   - **Discard** the change set.
4. Click **Apply to N device(s)**. LabTracer applies the devices one after the other, each with the steps of [Apply](#push-the-model-to-a-device). With **Stop at the first device that fails**, the next devices are skipped. The review then shows each device's result, backup and transcript.

server.py keeps the change sets in `data/changes/<lab>/`. A change set can only be applied in the version you reviewed: if it changed since (another window), LabTracer asks you to review it again. An applied or discarded change set can not change any more; **History** lists them all with their results.

### Audit log

`data/audit/<lab>.jsonl` gets one line for each event: change sets created, staged, edited, discarded and applied; backups; rollback timers; applies (with the commands, the files and the transcript); confirmations, rollbacks, restores and saves; discoveries; remote sessions. Each line has the time, the user who runs LabTracer, the device and the result.

Open it with **Audit log** in the lab panel, or **Audit** in the Drift tab of a device (that device only). **Export** saves it as JSON Lines. Each entry holds the hash of the entry before it, so the viewer shows when a line was changed or removed ("chain intact"). This shows tampering; it does not prevent it.

## Backups and recovery

Before each change it applies, LabTracer keeps the config of the device in `data/backups/<lab>/<device>/` (the newest 30 per device). In the Drift tab, click **Backups** to see them:

- **view**: the config (Linux: the network config files). **Download** saves it.
- **restore**: puts the backup back on the device (see the table above), then reads the device again.

If a device can not be reached after a change:

1. With a rollback timer, wait until the timer ends: the device goes back to its old config by itself (IOS without archive: it restarts). Then click **Collect now**.
2. Without a timer, reach the device another way (console cable, another address). The backup has the old config: on IOS, `configure replace flash:lt-<id>.cfg force`; on Linux, `tar -xzf /var/backups/labtracer/<id>.tgz -C /` then reload the network config; on RouterOS, `/system backup load name=lt-<id>.backup`.

## Remote access (Guacamole)

LabTracer can open RDP, VNC, SSH and Telnet sessions in a window of the app, over Apache Guacamole:

```
browser (Guacamole client)  <-- WebSocket -->  server.py  <-- TCP 4822 -->  guacd  <-- RDP / VNC / SSH / Telnet -->  device
```

Only guacd, the Guacamole server daemon, is needed: no Tomcat, no Guacamole web app, no database. server.py speaks the Guacamole protocol to guacd itself.

1. Start guacd on this PC or on a server: `docker run -d -p 127.0.0.1:4822:4822 guacamole/guacd`, or install the `guacd` package.
2. In the lab panel, under **Remote access (Guacamole)**, set the guacd address (default `127.0.0.1:4822`). Click **Test**.
3. Select a device. Open the Console tab and click **Remote**.
4. Set the protocol, host (empty: the SSH host or the first IP), port (0: the default for the protocol), user and, for RDP, the domain, security mode and keyboard layout.
5. Click **Connect**. Type the password (or leave it empty to log in on the remote screen).

The session opens in a window that you can move (drag the title bar) and resize (drag the corner; an RDP desktop follows the size). Click the screen to type into it. The window has the buttons **Ctrl+Alt+Del**, **Win** (the Windows key), **Paste…** (sends text to the remote clipboard; text copied on the remote side goes to your clipboard) and **Fit** (scale to the window, or 100%). Several sessions can be open at once (at most 8). Each session start and end goes into the audit log.

guacd connects to the device, so it must reach the device's address. If guacd runs on another computer, protect port 4822 (a firewall rule, or TLS: guacd `-C` and `-K`, then tick "guacd uses TLS").

The Guacamole client (`app/guac.js`, 73 KB) loads only when you open the first session.

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
| 1, 2, 3 | Topology view, room view, inventory |
| [ , ] | Hide or show the left panel, the right panel |
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
- The SSH console is off when server.py listens on an address that is not loopback.
- An SSH session starts with a POST request that must have the `X-LabTracer` header. The server answers with a one-time session ID, which is valid for 30 seconds. The WebSocket must give this ID and must come from the LabTracer page (Origin check).
- Host, user and key path are validated. server.py starts `ssh` with an argument list, not with a shell.
- SSH passwords are never stored. New host keys need your confirmation. Changed host keys are refused.
- Collect and Push (drift) use the same rules as the SSH console: off on a network address, passwords used for one run only, new host keys confirmed by you. Collect only reads devices.
- Push takes operations, not command text, from the browser. Each value is checked against a strict pattern (interface names, addresses, VLAN numbers and lists, names), and the device driver writes the commands. Apply runs a reviewed plan once, within 10 minutes.
- The live events WebSocket (`/api/events`) checks the Origin like the SSH console. It carries no secrets.
- A change set is applied only in the version you reviewed (a digest of every device's commands and files). Each change is logged with its commands and transcript in a hash-chained audit log.
- Linux push: LabTracer writes a config file only when it is the same as at the last collect, and stops at the first command that fails. It needs root or `sudo -n`; it never asks for or stores a sudo password.
- Discovery uses the same rules as Collect: off on a network address, read-only, passwords for one run only. It sweeps only the ranges you type; with Crawl, also the private addresses that your devices report. "Trust the host key of devices seen for the first time" is off by default, and each key it saves is logged.
- Remote access (Guacamole) uses the same rules as the SSH console: off on a network address, a one-time session id, an Origin check, passwords for one connect only. The connection parameters come from a fixed list: drive mapping, printing, session recording and SFTP, which write files on the guacd host, can not be turned on. The browser may only send input and display instructions to guacd.
- Monitoring backends are read-only. Their tokens and passwords are kept in `data/monitor.json`, like the agent token.

## Git

The `.gitignore` ignores all files, then allows only the files of the app. This prevents accidental commits of personal data.

These items are never committed:

- The `data` folder: labs, lab history, custom objects, exported configs, agent address and token, monitoring credentials, SSH host keys, facts collected from devices, discovery results, change sets, backups of device configs and the audit log.
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
3. Run `npm run build`. This writes `app/app.js`, `app/app.css` and `app/guac.js` (the Guacamole client, loaded only for a remote session).
4. Optional: run `npm run dev` to rebuild on each change. This build is not minified and has a source map. Run `npm run build` again before you commit.

`app/app.js`, `app/app.css` and `app/guac.js` are in git, so the app runs without Node.js. Commit them together with the `src/` change that made them:

- `npm test` fails if they are not the build of the current `src/`. To check only this, run `npm run check:build`.
- `git diff` shows them as binary (see `.gitattributes`), so the diffs show only your source changes.
- On a merge conflict in these files, do not merge them by hand. Run `npm run build` and add the result.

## Change the lab format

Do this when a change in `src/` renames, moves or removes a field in the lab file (or in `library.json`). A new field with a default value needs no format change: `normalizeLab()` in `src/model.js` fills it in.

1. In `src/migrations.js`, add a step at the end of `LAB_STEPS` (or `LIBRARY_STEPS`): `{ to: <last version + 1>, note: 'what changed', up(lab) { ... } }`. The step changes a file of the previous format into the new format.
2. Never change a step after a release. Users have files of every older format.
3. Save a lab in the new format as `tests/fixtures/lab-v<new version>.json` (or `library-v<n>.json`).
4. Add the file to `tests/fixtures/FROZEN.json`. Run `npm test`: the error message gives the hash to add.
5. Do not edit the older fixtures. They stand for real files on users' disks.

`npm test` fails if a step number is missing, if a format has no fixture, or if a fixture changed.

## Tests

The tests are in the `tests` folder. They never use your `data` folder: the server and browser tests start their own copy of the server in a temporary folder.

| Command | What it tests | Needs |
|---|---|---|
| `npm test` | `app/` matches `src/`; undo and redo (diff and patch, 300 random edits); format versions and migrations (every old file in `tests/fixtures` still opens); inventory: CSV parsing, import, export round trip; the drift report; the Nagios export; discovery to lab (devices, ports, cables from LLDP and MAC tables). | Node.js 18 or later, and `npm install`. |
| `npm run test:py` | server.py guards and save conflicts, ssh_bridge.py, the check agent and its Nagios source, the live events WebSocket, the collector drivers (on recorded device output), push: operation checks, IOS commands, apply on a simulated IOS CLI; change sets, backups, rollback timers and restore (multi-device apply, unreachable device); the Linux persistent push (ifupdown2, NetworkManager, netplan) on a simulated host; the RouterOS driver; the IOS backup and timer questions; the audit log chain; the Guacamole tunnel (handshake, relay, refused instructions) with a fake guacd; the Prometheus, Zabbix, Icinga 2 and LibreNMS backends with a fake API; discovery helpers. | Python 3.8 or later. The agent TLS test also needs the `openssl` command (it is skipped without it). |
| `npm run test:ui` | The app in a headless browser: every view, panel and tab, inventory, import, undo and redo, two-window saves, a damaged lab file, push review, staging and the audit log, the remote access form. | `npm install`, Python 3, and Edge, Chrome or Chromium. |
| `npm run test:all` | All of the above. | All of the above. |

Without Node.js, run the Python tests with `python -m unittest discover -s tests -v`.

If the browser test does not find your browser, set `LABTRACER_BROWSER` to the path of its executable. On Linux, the tests use `python3`; set `PYTHON` to use a different interpreter.

Run `npm run build` before `npm run test:ui`: the browser test uses `app/app.js`.

## Files

| Path | Contents |
|---|---|
| `server.py` | Local server and storage API. |
| `ssh_bridge.py` | SSH console: WebSocket, paramiko and System ssh engines. |
| `guac.py` | Remote access: the Guacamole protocol to guacd, and the WebSocket tunnel for the browser. |
| `monitoring.py` | Monitoring backends (Prometheus, Zabbix, Icinga 2, LibreNMS) in the agent's status format. |
| `collector/` | Collect and push for the drift report: jobs and plans (`__init__.py`), SSH commands (`conn.py`), the facts format that every driver fills (`facts.py`), stored facts (`store.py`), push operations and their checks (`ops.py`), one driver per platform (`drivers/`: detect, read, render commands, apply, backup, rollback timer, restore), change sets (`changes.py`), backups (`backups.py`), the audit log (`audit.py`), discovery (`discover.py`). |
| `app/` | The built web app (`index.html`, `style.css`, `app.js`, and `guac.js`: the Guacamole client, loaded only for a remote session). |
| `build.mjs` | Build of `app/app.js` and `app/guac.js` from `src/`, and the check that they match. |
| `src/main.js` | App state, save, selection, views, keyboard. |
| `src/main/` | App features: placing devices (`placement.js`), the link tool (`linking.js`), edits (`edits.js`), the File menu (`files.js`), the Settings dialog (`settings.js`). |
| `src/history.js` | Undo and redo. Each step keeps only the changes (`src/patch.js`). |
| `src/migrations.js` | Format versions of lab and library files, and the steps that upgrade older files. |
| `src/panels.js` | Side panels: hide, show and resize. |
| `src/viewport.js` | Three.js views: scene, devices, selection, camera. |
| `src/viewport/` | The room and grid (`environment.js`), cables and cable routes (`cables.js`), live status and packet animation (`effects.js`), mouse input (`pointer.js`). |
| `src/models3d.js` | Procedural 3D models and front panel textures. |
| `src/inspector.js` | Properties panel: tabs and bound inputs. |
| `src/inspector/` | One file for each tab of a device (`general.js`, `physical.js`, `ports.js`, `routing.js`, `files.js`, `console.js`, `monitor.js`, `drift.js`), the link panel (`link.js`), the lab panel (`lab.js`) and its Nagios section (`nagios.js`). |
| `src/palette.js` | Device library and custom object editor. |
| `src/cli.js` | Console commands and running-config generator. |
| `src/netsim.js` | Network simulator. |
| `src/model.js` | Lab data model. |
| `src/templates.js` | Built-in device types. |
| `src/sample.js` | Example lab (placeholder names and addresses). |
| `src/store.js` | Storage (server or browser). |
| `src/monitor.js` | Live status from the check agent or a monitoring backend. |
| `src/discover.js` | Discovery: the dialogs, and the lab made from a discovery result. |
| `src/changes.js` | Change sets (stage, review, apply), the audit log viewer, backups and restore. |
| `src/remote.js` | Remote access windows (Guacamole client). `src/guac-entry.js` builds `app/guac.js`. |
| `src/inventory.js` | Inventory table, CSV import and export. |
| `src/sshterm.js` | SSH console in the browser (xterm.js). |
| `src/drift.js` | Drift report: compares the model with the facts read from a device. |
| `src/collect.js` | Collect and push in the browser: starts runs, keeps the facts of the open lab, shows commands for review. |
| `src/events.js` | Live events WebSocket from server.py (monitor status, jobs, new facts). |
| `src/nagios.js` | Nagios config made from the lab (hosts, parents from the cables, services, hostgroups). |
| `src/dialogs.js` | Dialogs, popups and toasts. |
| `src/diff.js` | Line diff for config snapshots and Compare config. |
| `src/util.js` | Shared helpers: DOM building, ids, IP math, `mixin()`. |
| `agent/` | The check agent, its systemd unit and its instructions. |
| `tests/` | Tests: `build.test.mjs`, `history.test.mjs`, `migrations.test.mjs`, `inventory.test.mjs`, `drift.test.mjs`, `nagios.test.mjs`, `discover.test.mjs` (Node), `test_server.py`, `test_collector.py`, `test_remediate.py`, `test_ops.py` (Python, started by `run-py.mjs`), `ui.test.mjs` (browser). |
| `tests/collect-fixtures/` | Recorded device output and the facts the drivers must make from it (`python tests/test_collector.py --regen` updates the facts after a deliberate parser change). |
| `tests/fixtures/` | One saved lab and library for each format version. Frozen: never edit them. |

Each file in `src/main/`, `src/inspector/` and `src/viewport/` holds a part class. `mixin()` in `src/util.js` copies its methods onto `App`, `Inspector` or `Viewport`. A method name can be in only one file: a duplicate stops the app at startup with an error.

Three.js and xterm.js (MIT licence) are bundled into `app/app.js` and `app/app.css`. The Apache Guacamole client (guacamole-common-js 1.5.0, Apache License 2.0) is bundled into `app/guac.js`.
