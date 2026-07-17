# Garmin G5 Improvements for MSFS 2024

This addon is based on original addon from tb110188 [Enhanced Garmin G5 Attachment](https://flightsim.to/addon/104825/enhanced-garmin-g5-attachment).

The goal of the project is to improve the usability, e.g. better scrolling and setting mechanism and add the functionality,
which will support full IFR use of the avionics. Specifically the pages for VOR/GPS navigation, heading vs track indication etc.

## Development

The instrument sources live in `src/instruments/Enhanced-AS5/`, with the code organized under `modules/` as follows:

```
modules/
├── AS5.tsx                  instrument entry point
│
├── common/                  cross-cutting code shared by PFD & MFD
├── pfd/                     PFD display components & layout
├── mfd/                     MFD display components & layout
├── publishers/              EventBus SimVar publishers
└── providers/               data providers, nav infrastructure & types
```

Common commands:

- `npm run format` — format the code (run after every change)
- `npm run lint` — lint the code and fix warnings
- `npm run build` — build the addon
