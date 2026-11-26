# LabTracer check agent

The check agent gives live status to LabTracer. It is a small program that uses only the Python standard library.

The agent does these checks:

- ICMP ping to the address of each device.
- TCP connect to each TCP service port in the Services tab of the device.

The agent does not log in to devices. It does not run commands on devices. It does not change devices.

## How the parts connect

```
LabTracer (your PC)                       Agent (always-on host)                 Devices
browser  -->  server.py  --PUT /targets-->  labtracer_agent.py  --ping/TCP-->  your devices
              (keeps token)  <--GET /status--
```

1. LabTracer makes a list of checks from the lab.
2. server.py sends the list to the agent.
3. The agent does the checks every 30 seconds.
4. server.py gets the results from the agent.
5. LabTracer shows the results in the 3D view and in the Monitor tab.

The browser does not connect to the agent. The token stays in `data/monitor.json` on your PC. That file is in `.gitignore`.

## Safety on an important host

You can run the agent on an important host, for example a domain controller. Thus the agent has these limits:

- It runs as the user `labtracer`. That user has no shell, no sudo and no capabilities.
- The systemd unit locks the file system, blocks privilege changes and limits the agent to 64 MB of RAM and 20% of one CPU core.
- The agent writes only one file: `/var/lib/labtracer-agent/targets.json`.
- The agent accepts only two check types: ping and TCP connect. It rejects other data in the target list.
- With Nagios as the source, it only reads the Nagios status file (or sends read-only `GET` queries to Livestatus).
- The agent does not start on a network address without a token of 16 characters or more.
- Each request must have the token.
- Without a token (loopback only), the agent accepts only requests with a local Host name. A web page can not reach it through DNS rebinding.
- A new target list must be sent as `Content-Type: application/json`. A web page can not send that to the agent.

The agent listens on a port on its host. Use nftables to accept that port only from your admin addresses.

## Install on a Linux host with systemd

Do these steps as root (use `sudo`).

### 1. Copy the files

1. Copy the `agent` folder to the host.
2. Run these commands:

```sh
install -d -m 0755 /opt/labtracer-agent
install -m 0644 labtracer_agent.py /opt/labtracer-agent/
install -m 0644 labtracer-agent.service /etc/systemd/system/
```

### 2. Make the service user

```sh
useradd --system --no-create-home --shell /usr/sbin/nologin labtracer
```

### 3. Make the token and the configuration

1. Make a token:

```sh
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

2. Copy the example configuration:

```sh
install -d -m 0750 -g labtracer /etc/labtracer-agent
install -m 0640 -g labtracer agent.example.json /etc/labtracer-agent/agent.json
```

3. Edit `/etc/labtracer-agent/agent.json`:
   - Set `token` to the token from step 1.
   - Set `bind` to the address of the host that your PC uses (for example `192.168.10.10`).
   - Keep `port` 8766, or use a different free port.

Do not put the token in git. `agent.json` is in `.gitignore`. Store it in your password manager.

### 4. Open the port in nftables

Accept the port only from the addresses of your admin devices. Example for a VPN subnet and one LAN workstation:

```
tcp dport 8766 ip saddr { 10.99.0.0/24, 192.168.10.20 } accept
```

Put this rule in your input chain, before the drop rule. Change the addresses to your admin addresses. Then reload nftables:

```sh
nft -c -f /etc/nftables.conf && systemctl reload nftables
```

The `nft -c` command checks the file before you load it.

### 5. Start the agent

```sh
systemctl daemon-reload
systemctl enable --now labtracer-agent
systemctl status labtracer-agent
journalctl -u labtracer-agent -n 20
```

The log must show a line like this:

```
labtracer-agent 1.0 on http://192.168.10.10:8766  (0 targets, every 30s)
```

### 6. Test from your PC

```sh
curl -s http://192.168.10.10:8766/health
curl -s -H "Authorization: Bearer YOUR-TOKEN" http://192.168.10.10:8766/status
```

The first command must give `{"ok": true}`. The second command must give a JSON status document.

## Connect LabTracer

1. Start LabTracer.
2. Click an empty area of the 3D view. The lab panel opens.
3. Find "Monitoring agent".
4. Type the agent address, for example `http://192.168.10.10:8766`.
5. Paste the token.
6. Click "Test". A message shows the agent host name.
7. Click "Start live" or click "Live" in the toolbar.

When live status is on:

- Each device label shows a coloured dot. A ring shows under the device.
- Green is up. Orange is degraded (some checks fail). Red is down (all checks fail). Grey is unknown (no recent result).
- The Live button shows the counts.
- The Monitor tab of a device shows each check, the latency and the history.
- LabTracer sends a new target list to the agent a few seconds after you change the lab.

## Select what is checked

Open the Monitor tab of a device.

| Field | Function |
|---|---|
| Monitor this device | Turns the checks on or off for the device. Devices with an IP address are on by default. |
| Address to check | The address to check. If you keep it empty, LabTracer uses the first IP address in the Ports tab. |
| Ping | Sends a ping to the address. |
| TCP connect to service ports | Connects to each TCP port in the Services tab. |

Port formats in the Services tab:

| Text | Result |
|---|---|
| `22` | TCP 22 is checked. |
| `389,636` | TCP 389 and TCP 636 are checked. |
| `8006/tcp` | TCP 8006 is checked. |
| `51880/udp` | Not checked. UDP has no connection to test. |

## Use HTTPS (optional)

You can use a certificate from your own CA.

1. Issue a certificate for the agent, for example `agent.lab.example`.
2. Put the certificate and the key in `/etc/labtracer-agent/`. Set the owner to `root:labtracer` and the mode to `0640`.
3. In `agent.json`, set `tls_cert` and `tls_key` to the two file paths.
4. Restart the agent: `systemctl restart labtracer-agent`.
5. In LabTracer, change the agent address to `https://agent.lab.example:8766`.
6. In "CA file (HTTPS)", type the path to your CA certificate on your PC.

Do not use "Skip TLS certificate check" for more than a short test.

## Use Nagios (optional)

The agent can show the results of a Nagios server instead of doing its own checks. Nagios then does the checks, with its plugins, notifications and history. LabTracer shows the results in the 3D view and in the Monitor tab. Nagios Core 4, Naemon, Icinga 1 and Checkmk work.

```text
LabTracer (your PC)                   Nagios host
server.py  --GET /status-->  labtracer_agent.py  --reads-->  status.dat or Livestatus
                                                              Nagios  --checks-->  your devices
```

In this mode the agent still reads only. It reads `status.dat`, or sends `GET` queries to Livestatus. It does no checks and runs no commands.

### 1. Make the Nagios config from the lab

1. In LabTracer, click an empty area of the 3D view. The lab panel opens.
2. In the **Nagios** section, set **Nagios runs on** to the device that runs Nagios. LabTracer sets the host parents from the cables, as seen from this device. Then Nagios reports a device behind a failed switch as UNREACHABLE, not as DOWN.
3. Click **Export**. LabTracer writes `data/export/<lab>/nagios/labtracer-<lab>.cfg`. (Without server.py, click **Download**.)
4. Copy the file to the Nagios host, into its own folder, for example `/usr/local/nagios/etc/labtracer/`.
5. Add the folder to `nagios.cfg` (one time only):

```ini
cfg_dir=/usr/local/nagios/etc/labtracer
```

6. Check the config, then reload Nagios:

```sh
/usr/local/nagios/bin/nagios -v /usr/local/nagios/etc/nagios.cfg && systemctl reload nagios
```

The paths above are those of Nagios Core built from source. Packages use other paths. For example, on Debian (`apt install nagios4 monitoring-plugins`) the main file is `/etc/nagios4/nagios.cfg`, the command is `nagios4` and the service is `nagios4`.

The file uses the `generic-host` and `generic-service` templates, the `admins` contact group and the commands `check-host-alive`, `check_ssh`, `check_http` and `check_tcp`. The sample config of Nagios Core has all of them. If `nagios -v` says one is missing, find out where your install defines its commands:

```sh
grep -rn "command_name" /usr/local/nagios/etc/ | grep -E "check_tcp|check_http|check_ssh|check-host-alive"
```

Export again after you change the lab. Do not edit the file: the next export replaces it.

### 2. Point the agent at Nagios

Install the agent on the Nagios host (see above). Then:

1. Find the status file of your Nagios:

```sh
grep ^status_file /usr/local/nagios/etc/nagios.cfg
```

2. Let the `labtracer` user read it. On most installs the file belongs to the group `nagios`:

```sh
ls -l /usr/local/nagios/var/status.dat
usermod -aG nagios labtracer
```

3. In `/etc/labtracer-agent/agent.json`, set:

```json
"source": "nagios",
"nagios_status": "/usr/local/nagios/var/status.dat",
"interval": 10
```

Reading the status file costs almost nothing, so an interval of 10 seconds is fine. Nagios writes the file every 10 seconds (`status_update_interval` in `nagios.cfg`).

4. Restart the agent: `systemctl restart labtracer-agent`.
5. Test: `curl -s -H "Authorization: Bearer YOUR-TOKEN" http://127.0.0.1:8766/status`. The answer must have `"source": "nagios"`, the Nagios host names in `nagiosHosts`, and an empty `"error"`.

For Naemon, Checkmk, or Nagios with the Livestatus module, you can set `"livestatus": "/path/to/live"` (the socket) instead of `nagios_status`. The `labtracer` user must be allowed to write to the socket (usually the group of Nagios).

### What LabTracer shows

| Nagios | LabTracer |
|---|---|
| Host UP, all services OK | Green (up) |
| Host UP, a service WARNING, CRITICAL or UNKNOWN | Orange (degraded) |
| Host DOWN | Red (down) |
| Host UNREACHABLE (a parent is down), PENDING, or not in Nagios | Grey (unknown) |

The Monitor tab shows each Nagios check with its output. The lab panel lists the hosts that are in Nagios but not in the lab, and the reverse.

The agent finds each device by the `_LABTRACER_ID` custom variable of the export. If a host has none (you defined it yourself), it uses the host name. If the status file is more than 5 minutes old (`nagios_max_age`), LabTracer shows "is Nagios running?".

## Troubleshooting

| Problem | Cause and action |
|---|---|
| Ping always fails but TCP works | The kernel does not let the `labtracer` user send ping packets. Run `sysctl net.ipv4.ping_group_range`. The range must include the group ID of `labtracer`. On current Debian and Raspberry Pi OS, systemd sets it to `0 2147483647`. |
| LabTracer shows "agent said 401" | The token is wrong. Paste it again and click Save. |
| LabTracer shows "timed out" or "refused" | Check the nftables rule, the `bind` address and that the service runs. |
| A device shows down, but it works | Some devices drop ping. Turn off Ping for that device and add a TCP service port. |

## Run the agent on a different computer

The agent also runs on Windows or Linux without systemd:

```sh
python3 labtracer_agent.py --token YOUR-TOKEN --bind 127.0.0.1 --port 8766
```

To do one check run and print the result:

```sh
python3 labtracer_agent.py --once --state-dir .
```
