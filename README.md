# Accident Diagram Builder

Vehicles placed on the diagram are automatically identified as Unit 1, Unit 2, and so on. Select a vehicle to change its unit number or direction of travel in the Properties panel. Direction choices rotate the top-down vehicle to the corresponding compass direction, and unit labels are included in saved diagrams and PDF exports.

An ASP.NET Core Razor Pages application for creating accident-scene diagrams and downloading a formatted PDF report.

## Requirements

- .NET 8 SDK
- Google Maps Platform keys for Maps Static API, Maps JavaScript API, and Places API (New) (only required for Google Map features)

## Run the project

```bash
dotnet restore
dotnet run
```

Open the HTTPS or HTTP URL shown in the terminal.

## Configure Google Maps

Enable these APIs in a Google Cloud project with billing:

- [Maps Static API](https://developers.google.com/maps/documentation/maps-static/start) for the saved/PDF map background
- [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) for continuous dragging and zooming
- [Places API (New)](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) for address suggestions

Create two restricted keys:

- `StaticApiKey`: restrict to **Maps Static API** and, in production, the server's public IP address.
- `BrowserApiKey`: restrict to **Maps JavaScript API** and **Places API (New)** plus the application's website/referrer addresses.

Keep the two keys separate because server-IP and browser-referrer restrictions are different.

Using an environment variable:

```bash
export GoogleMaps__StaticApiKey="YOUR_SERVER_KEY"
export GoogleMaps__BrowserApiKey="YOUR_BROWSER_KEY"
dotnet run
```

Using .NET user secrets:

```bash
dotnet user-secrets init
dotnet user-secrets set "GoogleMaps:StaticApiKey" "YOUR_SERVER_KEY"
dotnet user-secrets set "GoogleMaps:BrowserApiKey" "YOUR_BROWSER_KEY"
dotnet run
```

For production, restrict the key to the Maps Static API and the web server's IP addresses. See Google's [API security best practices](https://developers.google.com/maps/api-security-best-practices).

## Main features

- Drag or click 62 scene objects covering regulatory and warning signs, traffic control, directions, road markings, measurements, safety equipment, accident symbols, surroundings, and vehicles
- Place a complete Four-Way Crosswalk around an intersection as one movable, resizable, and rotatable object
- Borderless road connectors let straight, vertical, T-intersection, and four-way intersection pieces overlap into one continuous roadway
- Smart road editing connects compatible endpoints within 30 pixels with a seamless overlap, magnetically snaps mouse rotation near 45-degree increments while keeping typed angles exact, and lets one road or all roads be locked in place
- Automatic road layering keeps road surfaces at the back, road markings above them, and vehicles, signs, arrows, collision markers, and labels clearly visible on top
- Diagram theme selector with **Full Color** as the default and a print-friendly **Monochrome** option; switching themes updates existing objects and all objects added afterward while preserving their original colors
- North compass and click-and-drag distance lines with editable real-world measurement labels for documenting scene orientation and measured distances
- Original Bootstrap-style vehicle icons in the toolbox and top-down vehicle diagrams on the report canvas, including Police, Ambulance, and NYC Access-A-Ride-style Paratransit; crash templates use blue and orange cars for easy visual distinction
- Automatic Unit 1, Unit 2, and subsequent vehicle labels with editable unit numbers and compass-based directions of travel; newly added vehicles default to Northbound
- Redesigned house scene object with a separate House Driveway object for flexible residential layouts
- Thirteen editable crash templates: rear-end, same- and opposite-direction sideswipe, lane change/merge, head-on, left turn, right turn, right angle, fixed object, pedestrian, bicycle, parked/backing, and multi-vehicle chain
- Editable street-name sign text from the Properties panel
- Editable speed-limit values from the Properties panel
- Move, resize, rotate, recolor, duplicate, flip, and reorder objects
- Freehand drawing, click-and-drag straight lines, labels, zoom, grid, keyboard movement, undo, and redo
- Interactive minimal Google Map with address suggestions, continuous pan/drag, mouse and button zoom, and a **Lock map & edit** action that prepares the chosen area for diagram editing and PDF export
- The map locks automatically when an editing tool is selected or an object is added, so dragging vehicles cannot accidentally pan the map
- Save an editable diagram as JSON and open it again later
- Download an A4 landscape accident report as PDF
- Professional two-row PDF header: Date, Time, Route, Run, Operator/Empl, Operator Pass/PR#, and Bus/VH# on the first row; Location, SLD/Manager, and Manager Pass/PR# on the second row

## Useful shortcuts

- `Delete` or `Backspace`: delete selected object
- `Ctrl+A`: select all unlocked diagram objects so the complete editable scene can be moved or rotated together
- `Ctrl+Z`: undo
- `Ctrl+Y` or `Ctrl+Shift+Z`: redo
- `Ctrl+D`: duplicate selected object
- Arrow keys: move selected object one pixel
- `Shift` + arrow keys: move selected object ten pixels
- `Escape`: clear selection or leave drawing mode

## Project notes

Diagram editing remains in the browser. The website-restricted browser key loads Google's interactive map and address suggestions. When **Lock map & edit**, **Save**, or **Download PDF** is selected, the app sends only the chosen coordinates and zoom to its Razor Page handler. The handler uses the separate server key to obtain a matching static image. That image becomes the Fabric.js canvas background, so it is retained in editable saves and included in downloaded PDFs. Other report and diagram data is not sent to the server.

The **Save** button downloads a JSON file containing the report fields and editable Fabric.js canvas. **Download PDF** creates the PDF in the browser.

Bootstrap 5, Bootstrap Icons, Fabric.js, and jsPDF are included under `wwwroot/lib`, so the editor does not depend on a CDN at runtime. Their license files are included beside the library files.
