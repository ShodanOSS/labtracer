// Built-in device templates. Dimensions are in metres (w = width, h = height, d = depth).
// Custom templates made in the app use the same shape and live in data/library.json.

const U = 0.04445; // one rack unit

/** Build a list of port specs: P('p', 1, 24, 'eth', '1G') -> p1..p24 */
export function P(prefix, start, count, kind = 'eth', speed = '1G') {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ name: `${prefix}${start + i}`, kind, speed });
  return out;
}

export const SHAPES = [
  ['rackmount', 'Rack-mount chassis'], ['box', 'Box'], ['router', 'Router (with antennas)'],
  ['ap', 'Access point (disc)'], ['tower', 'Tower'], ['nas', 'NAS'], ['laptop', 'Laptop'],
  ['phone', 'Phone / tablet'], ['sbc', 'Single-board computer'], ['camera', 'Camera'],
  ['printer', 'Printer'], ['cloud', 'Cloud / WAN'], ['vm', 'Virtual (ghost box)'],
  ['cylinder', 'Cylinder'], ['screen', 'Screen (TV / monitor)'], ['rack', 'Rack frame'], ['desk', 'Desk / table'], ['shelf', 'Shelving unit'],
];
export const FACES = [
  ['plain', 'Plain'], ['switch', 'Switch ports'], ['server', 'Drive bays'], ['router', 'Status LEDs'],
  ['firewall', 'Firewall'], ['tower', 'PC tower'], ['nas', 'NAS bays'], ['patch', 'Patch panel'],
  ['ups', 'UPS display'], ['pdu', 'PDU outlets'], ['vents', 'Vent grille'],
];
export const PORT_KINDS = ['eth', 'sfp', 'wifi', 'vport', 'tunnel', 'svi', 'sub', 'loop', 'console', 'usb', 'video', 'power'];
export const MEDIA = [
  ['auto', 'Auto'], ['copper', 'Copper (RJ45)'], ['fiber', 'Fibre / DAC'], ['wireless', 'Wireless'],
  ['tunnel', 'VPN tunnel'], ['virtual', 'Virtual'], ['console', 'Console'], ['video', 'Video (HDMI / DP)'], ['power', 'Power'],
];

export const BUILTIN = [
  // ---------------------------------------------------------------- Network
  { id: 'net-router-home', name: 'Router (consumer / DD-WRT)', category: 'Network', shape: 'router', face: 'router',
    dims: { w: 0.25, h: 0.05, d: 0.18 }, color: '#2b2f36', l2: true, l3: true,
    ports: [{ name: 'wan', kind: 'eth', speed: '1G', mode: 'routed' }, ...P('lan', 1, 4), { name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }, { name: 'wlan1', kind: 'wifi', speed: '5GHz' }, { name: 'pwr', kind: 'power' }] },
  { id: 'net-router-rack', name: 'Router 1U (ISR class)', category: 'Network', shape: 'rackmount', face: 'firewall',
    dims: { w: 0.44, h: U, d: 0.35 }, uHeight: 1, color: '#3a4a5c', l3: true,
    ports: [...P('Gi0/', 0, 3), { name: 'console', kind: 'console' }, { name: 'psu1', kind: 'power' }] },
  { id: 'net-firewall', name: 'Firewall appliance 1U', category: 'Network', shape: 'rackmount', face: 'firewall',
    dims: { w: 0.44, h: U, d: 0.3 }, uHeight: 1, color: '#7a2b2b', l3: true,
    ports: [{ name: 'wan', kind: 'eth', speed: '1G' }, { name: 'lan', kind: 'eth', speed: '1G' }, ...P('opt', 1, 6), { name: 'psu1', kind: 'power' }] },
  { id: 'net-switch-8', name: 'Desktop switch 8-port', category: 'Network', shape: 'box', face: 'switch',
    dims: { w: 0.26, h: 0.035, d: 0.16 }, color: '#4b5563', l2: true,
    ports: [...P('p', 1, 8), { name: 'pwr', kind: 'power' }] },
  { id: 'net-switch-5', name: 'Unmanaged switch 5-port', category: 'Network', shape: 'box', face: 'switch',
    dims: { w: 0.1, h: 0.025, d: 0.07 }, color: '#5b6470', l2: true,
    ports: [...P('p', 1, 5), { name: 'pwr', kind: 'power' }] },
  { id: 'net-switch-24', name: 'Managed switch 24-port 1U', category: 'Network', shape: 'rackmount', face: 'switch',
    dims: { w: 0.44, h: U, d: 0.3 }, uHeight: 1, color: '#2f4f6f', l2: true,
    ports: [...P('p', 1, 24), ...P('sfp', 1, 4, 'sfp', '10G'), { name: 'console', kind: 'console' }, { name: 'psu1', kind: 'power' }] },
  { id: 'net-switch-48', name: 'Managed switch 48-port 1U', category: 'Network', shape: 'rackmount', face: 'switch',
    dims: { w: 0.44, h: U, d: 0.38 }, uHeight: 1, color: '#2f4f6f', l2: true,
    ports: [...P('p', 1, 48), ...P('sfp', 1, 4, 'sfp', '10G'), { name: 'console', kind: 'console' }, { name: 'psu1', kind: 'power' }] },
  { id: 'net-switch-l3', name: 'L3 switch 24 + 4 SFP 1U', category: 'Network', shape: 'rackmount', face: 'switch',
    dims: { w: 0.44, h: U, d: 0.38 }, uHeight: 1, color: '#22577a', l2: true, l3: true,
    ports: [...P('Gi0/', 1, 24), ...P('Gi0/', 25, 4, 'sfp', '1G'), { name: 'console', kind: 'console' }, { name: 'psu1', kind: 'power' }] },
  { id: 'net-switch-l3-48', name: 'L3 switch 48 + 4 SFP 1U', category: 'Network', shape: 'rackmount', face: 'switch',
    dims: { w: 0.44, h: U, d: 0.38 }, uHeight: 1, color: '#22577a', l2: true, l3: true,
    ports: [...P('Gi0/', 1, 48), ...P('Gi0/', 49, 4, 'sfp', '1G'), { name: 'console', kind: 'console' }, { name: 'psu1', kind: 'power' }] },
  { id: 'net-ap', name: 'Wireless access point', category: 'Network', shape: 'ap', face: 'plain',
    dims: { w: 0.2, h: 0.04, d: 0.2 }, color: '#e8eaed', l2: true,
    ports: [{ name: 'eth0', kind: 'eth', speed: '1G', mode: 'trunk' }, { name: 'wlan0', kind: 'wifi', speed: '5GHz' }] },
  { id: 'net-gateway', name: 'ISP fibre gateway / modem', category: 'Network', shape: 'box', face: 'router',
    dims: { w: 0.06, h: 0.24, d: 0.2 }, color: '#d9dde3', l2: true, l3: true,
    ports: [{ name: 'pon', kind: 'sfp', speed: 'GPON', mode: 'routed' }, ...P('lan', 1, 4), { name: 'wlan0', kind: 'wifi' }, { name: 'pwr', kind: 'power' }] },
  { id: 'net-patch-24', name: 'Patch panel 24-port 1U', category: 'Network', shape: 'rackmount', face: 'patch',
    dims: { w: 0.44, h: U, d: 0.1 }, uHeight: 1, color: '#1f2328', passthrough: true,
    ports: [...P('', 1, 24).map(p => ({ ...p, name: p.name + 'F' })), ...P('', 1, 24).map(p => ({ ...p, name: p.name + 'R' }))] },

  // ---------------------------------------------------------------- Compute
  { id: 'cmp-1u', name: 'Rack server 1U (8 SFF)', category: 'Compute', shape: 'rackmount', face: 'server', bays: 8,
    dims: { w: 0.43, h: U, d: 0.7 }, uHeight: 1, color: '#30343b',
    ports: [...P('eno', 1, 4), ...P('ens1f', 0, 2, 'sfp', '10G'), { name: 'ilo', kind: 'eth', speed: '1G' }, { name: 'psu1', kind: 'power' }, { name: 'psu2', kind: 'power' }],
    attrs: { CPU: '', RAM: '', Storage: '', OS: '' } },
  { id: 'cmp-2u', name: 'Rack server 2U (12 LFF)', category: 'Compute', shape: 'rackmount', face: 'server', bays: 12,
    dims: { w: 0.43, h: 2 * U, d: 0.72 }, uHeight: 2, color: '#30343b',
    ports: [...P('eno', 1, 4), { name: 'bmc', kind: 'eth', speed: '1G' }, { name: 'psu1', kind: 'power' }, { name: 'psu2', kind: 'power' }],
    attrs: { CPU: '', RAM: '', Storage: '', OS: '' } },
  { id: 'cmp-tower', name: 'Desktop tower PC', category: 'Compute', shape: 'tower', face: 'tower',
    dims: { w: 0.21, h: 0.46, d: 0.45 }, color: '#1d1f24',
    ports: [{ name: 'eth0', kind: 'eth', speed: '1G' }, { name: 'wlan0', kind: 'wifi' }, { name: 'psu', kind: 'power' }],
    attrs: { CPU: '', RAM: '', GPU: '', OS: '' } },
  { id: 'cmp-mini', name: 'Mini PC (1L)', category: 'Compute', shape: 'box', face: 'vents',
    dims: { w: 0.177, h: 0.034, d: 0.175 }, color: '#2a2d33',
    ports: [{ name: 'eth0', kind: 'eth', speed: '1G' }, { name: 'wlan0', kind: 'wifi' }, { name: 'pwr', kind: 'power' }],
    attrs: { CPU: '', RAM: '', OS: '' } },
  { id: 'cmp-sff', name: 'Small form factor desktop', category: 'Compute', shape: 'tower', face: 'tower',
    dims: { w: 0.1, h: 0.29, d: 0.3 }, color: '#2a2d33',
    ports: [{ name: 'eth0', kind: 'eth', speed: '1G' }, { name: 'pwr', kind: 'power' }], attrs: { CPU: '', RAM: '', OS: '' } },
  { id: 'cmp-laptop', name: 'Laptop', category: 'Compute', shape: 'laptop', face: 'plain',
    dims: { w: 0.34, h: 0.022, d: 0.235 }, color: '#3b3f46',
    ports: [{ name: 'wlan0', kind: 'wifi' }, { name: 'eth0', kind: 'eth' }, { name: 'wg0', kind: 'tunnel' }], attrs: { OS: '' } },
  { id: 'cmp-sbc', name: 'Single-board computer (Pi class)', category: 'Compute', shape: 'sbc', face: 'plain',
    dims: { w: 0.09, h: 0.03, d: 0.065 }, color: '#1b7a3e',
    ports: [{ name: 'eth0', kind: 'eth', speed: '1G' }, { name: 'wlan0', kind: 'wifi' }, { name: 'usb-c', kind: 'power' }], attrs: { OS: '' } },

  // ---------------------------------------------------------------- Storage
  { id: 'sto-nas2', name: 'NAS 2-bay', category: 'Storage', shape: 'nas', face: 'nas', bays: 2,
    dims: { w: 0.105, h: 0.17, d: 0.23 }, color: '#2b2e33',
    ports: [{ name: 'eth0', kind: 'eth' }, { name: 'eth1', kind: 'eth' }, { name: 'pwr', kind: 'power' }], attrs: { Drives: '', OS: '' } },
  { id: 'sto-nas4', name: 'NAS 4-bay', category: 'Storage', shape: 'nas', face: 'nas', bays: 4,
    dims: { w: 0.17, h: 0.19, d: 0.23 }, color: '#2b2e33',
    ports: [{ name: 'eth0', kind: 'eth' }, { name: 'eth1', kind: 'eth' }, { name: 'pwr', kind: 'power' }], attrs: { Drives: '', OS: '' } },
  { id: 'sto-rack', name: 'Rack NAS 1U (4 LFF)', category: 'Storage', shape: 'rackmount', face: 'server', bays: 4,
    dims: { w: 0.43, h: U, d: 0.5 }, uHeight: 1, color: '#2b2e33',
    ports: [...P('eth', 0, 2), ...P('sfp', 0, 2, 'sfp', '10G'), { name: 'psu1', kind: 'power' }], attrs: { Drives: '' } },

  // ---------------------------------------------------------------- Virtual
  { id: 'vir-vm', name: 'Virtual machine', category: 'Virtual', shape: 'vm', face: 'plain', virtual: true,
    dims: { w: 0.35, h: 0.35, d: 0.35 }, color: '#6d5dfc',
    ports: [{ name: 'eth0', kind: 'vport' }], attrs: { Host: '', vCPU: '', RAM: '', OS: '' } },
  { id: 'vir-ct', name: 'Container', category: 'Virtual', shape: 'vm', face: 'plain', virtual: true,
    dims: { w: 0.25, h: 0.25, d: 0.25 }, color: '#0ea5a5',
    ports: [{ name: 'eth0', kind: 'vport' }], attrs: { Host: '', Image: '' } },

  // ---------------------------------------------------------------- Endpoints
  { id: 'end-phone', name: 'Phone / tablet', category: 'Endpoints', shape: 'phone', face: 'plain',
    dims: { w: 0.075, h: 0.16, d: 0.009 }, color: '#111318',
    ports: [{ name: 'wlan0', kind: 'wifi' }, { name: 'wg0', kind: 'tunnel' }] },
  { id: 'end-printer', name: 'Printer', category: 'Endpoints', shape: 'printer', face: 'plain',
    dims: { w: 0.42, h: 0.26, d: 0.4 }, color: '#d6d8dc', ports: [{ name: 'eth0', kind: 'eth' }, { name: 'wlan0', kind: 'wifi' }] },
  { id: 'end-tv', name: 'Smart TV', category: 'Endpoints', shape: 'screen', face: 'plain',
    dims: { w: 1.23, h: 0.78, d: 0.06 }, color: '#16181c',
    ports: [{ name: 'eth0', kind: 'eth' }, { name: 'wlan0', kind: 'wifi' }, ...P('hdmi', 1, 3, 'video', 'HDMI'), { name: 'pwr', kind: 'power' }], attrs: { Size: '55"' } },
  { id: 'end-monitor', name: 'Monitor', category: 'Endpoints', shape: 'screen', face: 'plain',
    dims: { w: 0.61, h: 0.46, d: 0.05 }, color: '#1d1f24',
    ports: [{ name: 'dp1', kind: 'video', speed: 'DP' }, { name: 'hdmi1', kind: 'video', speed: 'HDMI' }, { name: 'usb-up', kind: 'usb' }, { name: 'pwr', kind: 'power' }], attrs: { Size: '27"' } },
  { id: 'end-camera', name: 'IP camera', category: 'Endpoints', shape: 'camera', face: 'plain',
    dims: { w: 0.08, h: 0.09, d: 0.18 }, color: '#eceff1', ports: [{ name: 'eth0', kind: 'eth', speed: 'PoE' }] },

  // ---------------------------------------------------------------- IoT (Wi-Fi clients: join an SSID in the Ports tab or on the link)
  { id: 'end-iot', name: 'IoT device (generic)', category: 'IoT', shape: 'box', face: 'router',
    dims: { w: 0.08, h: 0.03, d: 0.08 }, color: '#f2f2f2', ports: [{ name: 'wlan0', kind: 'wifi' }] },
  { id: 'iot-plug', name: 'Smart plug', category: 'IoT', shape: 'box', face: 'plain',
    dims: { w: 0.06, h: 0.06, d: 0.04 }, color: '#f5f5f5', ports: [{ name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }, { name: 'pwr', kind: 'power' }] },
  { id: 'iot-bulb', name: 'Smart bulb', category: 'IoT', shape: 'cylinder', face: 'plain',
    dims: { w: 0.06, h: 0.11, d: 0.06 }, color: '#fff4d6', ports: [{ name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }] },
  { id: 'iot-sensor', name: 'Sensor (temperature / motion)', category: 'IoT', shape: 'box', face: 'plain',
    dims: { w: 0.05, h: 0.02, d: 0.05 }, color: '#e9ecef', ports: [{ name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }], attrs: { Battery: '' } },
  { id: 'iot-thermostat', name: 'Thermostat', category: 'IoT', shape: 'box', face: 'plain',
    dims: { w: 0.09, h: 0.09, d: 0.025 }, color: '#f5f5f5', ports: [{ name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }] },
  { id: 'iot-camera', name: 'Wi-Fi camera', category: 'IoT', shape: 'camera', face: 'plain',
    dims: { w: 0.06, h: 0.1, d: 0.07 }, color: '#f0f0f0', ports: [{ name: 'wlan0', kind: 'wifi', speed: '2.4GHz' }, { name: 'pwr', kind: 'power' }] },
  { id: 'iot-speaker', name: 'Smart speaker / assistant', category: 'IoT', shape: 'cylinder', face: 'plain',
    dims: { w: 0.1, h: 0.15, d: 0.1 }, color: '#3a3d42', ports: [{ name: 'wlan0', kind: 'wifi', speed: '5GHz' }, { name: 'pwr', kind: 'power' }] },
  { id: 'iot-hub', name: 'Smart home hub (Zigbee / Thread)', category: 'IoT', shape: 'box', face: 'router',
    dims: { w: 0.1, h: 0.03, d: 0.1 }, color: '#f5f5f5', ports: [{ name: 'eth0', kind: 'eth' }, { name: 'wlan0', kind: 'wifi' }, { name: 'pwr', kind: 'power' }],
    attrs: { Radios: 'Zigbee, Thread' } },

  // ---------------------------------------------------------------- Power
  { id: 'pwr-ups-tower', name: 'UPS (tower)', category: 'Power', shape: 'box', face: 'ups',
    dims: { w: 0.15, h: 0.24, d: 0.4 }, color: '#202226',
    ports: [{ name: 'in', kind: 'power' }, ...P('out', 1, 6, 'power', ''), { name: 'usb', kind: 'usb' }], attrs: { VA: '', Battery: '' } },
  { id: 'pwr-ups-rack', name: 'UPS 2U rack', category: 'Power', shape: 'rackmount', face: 'ups',
    dims: { w: 0.43, h: 2 * U, d: 0.6 }, uHeight: 2, color: '#202226',
    ports: [{ name: 'in', kind: 'power' }, ...P('out', 1, 8, 'power', ''), { name: 'nmc', kind: 'eth' }], attrs: { VA: '', Battery: '' } },
  { id: 'pwr-pdu', name: 'PDU 1U', category: 'Power', shape: 'rackmount', face: 'pdu',
    dims: { w: 0.43, h: U, d: 0.2 }, uHeight: 1, color: '#1a1a1a',
    ports: [{ name: 'in', kind: 'power' }, ...P('out', 1, 8, 'power', '')] },

  // ---------------------------------------------------------------- WAN
  { id: 'wan-internet', name: 'Internet / ISP cloud', category: 'WAN', shape: 'cloud', face: 'plain', logical: true,
    dims: { w: 1.1, h: 0.55, d: 0.7 }, color: '#8ec5ff', l3: true, ports: P('wan', 1, 4) },

  // ---------------------------------------------------------------- Infrastructure (room only)
  { id: 'inf-rack-42', name: 'Rack 42U', category: 'Infrastructure', shape: 'rack', face: 'plain', physicalOnly: true,
    dims: { w: 0.6, h: 2.0, d: 1.0 }, rackUnits: 42, color: '#16181c', ports: [] },
  { id: 'inf-rack-24', name: 'Half rack 24U', category: 'Infrastructure', shape: 'rack', face: 'plain', physicalOnly: true,
    dims: { w: 0.6, h: 1.2, d: 0.8 }, rackUnits: 24, color: '#16181c', ports: [] },
  { id: 'inf-rack-12', name: 'Wall rack 12U', category: 'Infrastructure', shape: 'rack', face: 'plain', physicalOnly: true,
    dims: { w: 0.6, h: 0.64, d: 0.45 }, rackUnits: 12, color: '#16181c', ports: [] },
  // wall ports: front jack (room side) passes through to the rear jack (cable in the wall), like a patch panel
  { id: 'inf-wall-1', name: 'Wall port (single)', category: 'Infrastructure', shape: 'box', face: 'patch', passthrough: true, wall: true,
    dims: { w: 0.07, h: 0.115, d: 0.025 }, color: '#eceef0', ports: [{ name: '1F', kind: 'eth' }, { name: '1R', kind: 'eth' }] },
  { id: 'inf-wall-2', name: 'Wall port (double)', category: 'Infrastructure', shape: 'box', face: 'patch', passthrough: true, wall: true,
    dims: { w: 0.07, h: 0.115, d: 0.025 }, color: '#eceef0', ports: [{ name: '1F', kind: 'eth' }, { name: '2F', kind: 'eth' }, { name: '1R', kind: 'eth' }, { name: '2R', kind: 'eth' }] },
  { id: 'inf-desk', name: 'Desk', category: 'Infrastructure', shape: 'desk', face: 'plain', physicalOnly: true,
    dims: { w: 1.5, h: 0.75, d: 0.75 }, levels: [0.75], color: '#8b6b4a', ports: [] },
  { id: 'inf-shelf', name: 'Wire shelving unit', category: 'Infrastructure', shape: 'shelf', face: 'plain', physicalOnly: true,
    dims: { w: 0.9, h: 1.8, d: 0.45 }, levels: [0.15, 0.6, 1.05, 1.5], color: '#a7adb5', ports: [] },

  // ---------------------------------------------------------------- Parts (inventory items that are not network devices)
  { id: 'part-item', name: 'Generic item / part', category: 'Parts', shape: 'box', face: 'plain', physicalOnly: true,
    dims: { w: 0.25, h: 0.08, d: 0.2 }, color: '#6b7480', ports: [] },
  { id: 'part-drive', name: 'Drive (HDD / SSD)', category: 'Parts', shape: 'box', face: 'plain', physicalOnly: true,
    dims: { w: 0.102, h: 0.026, d: 0.147 }, color: '#8a9099', ports: [] },
];

export const CATEGORY_ORDER = ['Network', 'Compute', 'Storage', 'Virtual', 'Endpoints', 'IoT', 'Power', 'WAN', 'Infrastructure', 'Parts'];
export const RACK_U = U;
