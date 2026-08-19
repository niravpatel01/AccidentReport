(() => {
    "use strict";

    if (typeof fabric === "undefined") {
        window.alert("The diagram library could not be loaded. Check your internet connection and refresh the page.");
        return;
    }

    const CANVAS_WIDTH = 1000;
    const CANVAS_HEIGHT = 650;
    const AUTOSAVE_KEY = "accident-diagram-builder-autosave-v1";
    const MONOCHROME_ROAD_OPACITY = .4;
    const SERIALIZED_PROPERTIES = [
        "assetType", "displayName", "colorable", "strokeColorable", "selectedColor", "editableTextRole",
        "isVehicle", "vehicleId", "vehicleUnitNumber", "directionOfTravel", "isVehicleUnitLabel", "parentVehicleId", "roadLocked", "locked",
        "measurementLabel", "themeOriginalFill", "themeOriginalStroke", "themeOriginalBackgroundColor", "themeOriginalOpacity"
    ];
    const VEHICLE_ASSET_TYPES = new Set(["car", "truck", "motorcycle", "bus", "paratransit", "bicycle", "police-car", "ambulance"]);
    const ROAD_BASE_ASSET_TYPES = new Set(["road-horizontal", "road-vertical", "l-road", "intersection", "t-junction", "turn-lane", "driveway", "sidewalk"]);
    const ROAD_MARKING_ASSET_TYPES = new Set(["crosswalk", "four-way-crosswalk", "stop-line", "solid-line", "dashed-line"]);
    const ROAD_SNAPPABLE_ASSET_TYPES = new Set(["road-horizontal", "road-vertical", "l-road", "intersection", "t-junction"]);
    const ROAD_ENDPOINT_SNAP_DISTANCE = 30;
    const ROAD_ENDPOINT_OVERLAP = 6;
    const ROAD_ROTATION_INCREMENT = 45;
    const ROAD_ROTATION_THRESHOLD = 8;
    const VEHICLE_DIRECTIONS = {
        north: { angle: 0, shortLabel: "N" },
        northeast: { angle: 45, shortLabel: "NE" },
        east: { angle: 90, shortLabel: "E" },
        southeast: { angle: 135, shortLabel: "SE" },
        south: { angle: 180, shortLabel: "S" },
        southwest: { angle: 225, shortLabel: "SW" },
        west: { angle: 270, shortLabel: "W" },
        northwest: { angle: 315, shortLabel: "NW" },
        stationary: { angle: null, shortLabel: "Stationary" }
    };

    const byId = id => document.getElementById(id);
    const canvas = new fabric.Canvas("diagramCanvas", {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selectionColor: "rgba(37, 99, 235, .10)",
        selectionBorderColor: "#2563eb",
        selectionLineWidth: 1
    });

    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: "#ffffff",
        cornerStrokeColor: "#2563eb",
        borderColor: "#2563eb",
        cornerSize: 9,
        padding: 3
    });

    const elements = {
        newBtn: byId("newBtn"), templateBtn: byId("templateBtn"), undoBtn: byId("undoBtn"), redoBtn: byId("redoBtn"),
        selectBtn: byId("selectBtn"), selectAllBtn: byId("selectAllBtn"), drawBtn: byId("drawBtn"), lineBtn: byId("lineBtn"), measureBtn: byId("measureBtn"), addTextBtn: byId("addTextBtn"), deleteBtn: byId("deleteBtn"),
        zoomOutBtn: byId("zoomOutBtn"), zoomInBtn: byId("zoomInBtn"), zoomResetBtn: byId("zoomResetBtn"), zoomLabel: byId("zoomLabel"),
        saveBtn: byId("saveBtn"), loadFile: byId("loadFile"), pdfBtn: byId("pdfBtn"),
        canvasViewport: byId("canvasViewport"), canvasStage: byId("canvasStage"), gridToggle: byId("gridToggle"), sceneTheme: byId("sceneTheme"),
        blankCanvasMode: byId("blankCanvasMode"), googleMapMode: byId("googleMapMode"), googleMapPanel: byId("googleMapPanel"),
        mapAddress: byId("mapAddress"), mapAddressSuggestions: byId("mapAddressSuggestions"), mapZoom: byId("mapZoom"),
        loadMapBtn: byId("loadMapBtn"), mapNavigationBtn: byId("mapNavigationBtn"), mapStatus: byId("mapStatus"), googleMapCanvas: byId("googleMapCanvas"),
        objectCount: byId("objectCount"), assetSearch: byId("assetSearch"),
        selectedObjectName: byId("selectedObjectName"), emptyProperties: byId("emptyProperties"), objectProperties: byId("objectProperties"),
        objectLabel: byId("objectLabel"), objectLockedToggle: byId("objectLockedToggle"), streetNameGroup: byId("streetNameGroup"), streetNameText: byId("streetNameText"), speedLimitGroup: byId("speedLimitGroup"), speedLimitValue: byId("speedLimitValue"), textPropertiesGroup: byId("textPropertiesGroup"), textFontFamily: byId("textFontFamily"), textFontSize: byId("textFontSize"), textBoldBtn: byId("textBoldBtn"), textItalicBtn: byId("textItalicBtn"), measurementPropertiesGroup: byId("measurementPropertiesGroup"), measurementLabelText: byId("measurementLabelText"), vehiclePropertiesGroup: byId("vehiclePropertiesGroup"), vehicleUnitNumber: byId("vehicleUnitNumber"), vehicleDirection: byId("vehicleDirection"), roadPropertiesGroup: byId("roadPropertiesGroup"), roadLockHelp: byId("roadLockHelp"), lockAllRoadsBtn: byId("lockAllRoadsBtn"), unlockAllRoadsBtn: byId("unlockAllRoadsBtn"), fillColor: byId("fillColor"), opacityRange: byId("opacityRange"), opacityValue: byId("opacityValue"), angleInput: byId("angleInput"),
        rotateLeftBtn: byId("rotateLeftBtn"), rotateRightBtn: byId("rotateRightBtn"), duplicateBtn: byId("duplicateBtn"), flipBtn: byId("flipBtn"), frontBtn: byId("frontBtn"), backBtn: byId("backBtn"),
        reportNumber: byId("reportNumber"), accidentDate: byId("accidentDate"), accidentTime: byId("accidentTime"), route: byId("route"), run: byId("run"), operatorEmployee: byId("operatorEmployee"), operatorPassPrNumber: byId("operatorPassPrNumber"), busVehicleNumber: byId("busVehicleNumber"), sldManager: byId("sldManager"), managerPassPrNumber: byId("managerPassPrNumber"), location: byId("location"), preparedBy: byId("preparedBy"), reportNotes: byId("reportNotes"),
        templateModal: byId("templateModal"), confirmModal: byId("confirmModal"), confirmNewBtn: byId("confirmNewBtn"), toast: byId("appToast"), toastMessage: byId("appToastMessage")
    };

    let history = [];
    let historyIndex = -1;
    let historyLocked = false;
    let zoom = 1;
    let sceneTheme = "color";
    let objectSequence = 1;
    let vehicleIdSequence = 1;
    let interactionMode = "select";
    let lineStart = null;
    let lineEnd = null;
    let previewLine = null;
    let toastInstance = null;
    let templateModalInstance = null;
    let confirmModalInstance = null;
    let mapState = { enabled: false, address: "", zoom: 18, latitude: null, longitude: null };
    let googleMapsPromise = null;
    let googleMap = null;
    let placesLibrary = null;
    let autocompleteSessionToken = null;
    let autocompleteTimer = null;
    let currentSuggestions = [];
    let mapNavigationActive = false;
    let preservedMapBackground = null;

    const MINIMAL_GOOGLE_MAP_STYLES = [
        { featureType: "all", elementType: "geometry", stylers: [{ color: "#f5f6f7" }] },
        { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#8a9099" }] },
        { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
        { featureType: "all", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { featureType: "administrative", stylers: [{ visibility: "off" }] },
        { featureType: "landscape", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#d8dde3" }] },
        { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#e5e8ec" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#cbd2da" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#68717d" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#e7f0f4" }] }
    ];

    const horizontalTemplateRoad = () => ({ assetType: "road-horizontal", left: 500, top: 325, scaleX: 2.2, scaleY: 1.45 });
    const intersectionTemplateRoad = () => ({ assetType: "intersection", left: 500, top: 325, scale: 1.16 });
    const directionArrow = (left, top, angle) => ({ assetType: "vehicle-direction", left, top, angle, scale: .36 });
    const collisionMarker = (left, top, scale = .34) => ({ assetType: "collision-point", left, top, scale });
    const CRASH_TEMPLATES = {
        "rear-end": {
            name: "Rear-End",
            objects: [horizontalTemplateRoad(), directionArrow(290, 280, 0), directionArrow(705, 280, 0),
            { assetType: "car", left: 555, top: 280, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 395, top: 280, direction: "east", scale: .52 }, collisionMarker(480, 280)]
        },
        "sideswipe": {
            name: "Sideswipe",
            objects: [horizontalTemplateRoad(), directionArrow(300, 275, 0), directionArrow(300, 375, 0),
            { assetType: "car", left: 475, top: 275, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 505, top: 375, direction: "east", scale: .52 }, collisionMarker(525, 325, .3)]
        },
        "lane-change": {
            name: "Lane Change / Merge",
            objects: [horizontalTemplateRoad(), directionArrow(315, 275, 0), directionArrow(410, 350, -24),
            { assetType: "car", left: 520, top: 275, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 445, top: 375, direction: "northeast", scale: .52 }, collisionMarker(500, 325)]
        },
        "head-on": {
            name: "Head-On",
            objects: [horizontalTemplateRoad(), directionArrow(275, 300, 0), directionArrow(725, 300, 180),
            { assetType: "car", left: 400, top: 300, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 600, top: 300, direction: "west", scale: .52 }, collisionMarker(500, 300)]
        },
        "opposite-sideswipe": {
            name: "Opposite Sideswipe",
            objects: [horizontalTemplateRoad(), directionArrow(275, 290, 0), directionArrow(725, 355, 180),
            { assetType: "car", left: 445, top: 290, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 555, top: 355, direction: "west", scale: .52 }, collisionMarker(500, 323, .3)]
        },
        "left-turn": {
            name: "Left Turn",
            objects: [intersectionTemplateRoad(), directionArrow(500, 455, -90), directionArrow(500, 175, 90),
            { assetType: "car", left: 555, top: 365, direction: "northwest", scale: .54 },
            { assetType: "car", color: "#e17a2d", left: 500, top: 225, direction: "south", scale: .5 }, collisionMarker(525, 300)]
        },
        "right-turn": {
            name: "Right Turn",
            objects: [intersectionTemplateRoad(), directionArrow(500, 455, -90), directionArrow(700, 325, 180),
            { assetType: "car", left: 550, top: 395, direction: "northeast", scale: .54 },
            { assetType: "car", color: "#e17a2d", left: 650, top: 325, direction: "west", scale: .5 }, collisionMarker(590, 350)]
        },
        "right-angle": {
            name: "Right Angle",
            objects: [intersectionTemplateRoad(), directionArrow(300, 280, 0), directionArrow(520, 475, -90),
            { assetType: "car", left: 400, top: 280, direction: "east", scale: .54 },
            { assetType: "car", color: "#e17a2d", left: 520, top: 410, direction: "north", scale: .5 }, collisionMarker(520, 280)]
        },
        "fixed-object": {
            name: "Single Vehicle / Fixed Object",
            objects: [horizontalTemplateRoad(), { assetType: "skid-marks", left: 455, top: 350, angle: 24, scale: .65 },
            directionArrow(325, 285, 18), { assetType: "car", left: 510, top: 350, direction: "southeast", scale: .55 },
            { assetType: "tree", left: 650, top: 475, scale: .65 }, collisionMarker(610, 430)]
        },
        "pedestrian": {
            name: "Pedestrian",
            objects: [horizontalTemplateRoad(), { assetType: "crosswalk", left: 525, top: 325, angle: 90, scale: 1.25 },
            directionArrow(300, 280, 0), directionArrow(525, 435, -90),
            { assetType: "car", left: 410, top: 280, direction: "east", scale: .55 },
            { assetType: "pedestrian", left: 525, top: 355, scale: .62 }, collisionMarker(500, 315, .28)]
        },
        "bicycle": {
            name: "Bicycle",
            objects: [horizontalTemplateRoad(), directionArrow(285, 275, 0), directionArrow(310, 375, 0),
            { assetType: "car", left: 430, top: 275, direction: "east", scale: .55 },
            { assetType: "bicycle", left: 535, top: 375, direction: "east", scale: .62 }, collisionMarker(500, 325, .3)]
        },
        "parked-backing": {
            name: "Parked / Backing",
            objects: [horizontalTemplateRoad(), directionArrow(500, 470, -90),
            { assetType: "car", left: 625, top: 275, direction: "east", scale: .55 },
            { assetType: "car", color: "#e17a2d", left: 535, top: 405, direction: "north", scale: .52 }, collisionMarker(585, 335)]
        },
        "multi-vehicle": {
            name: "Multi-Vehicle Chain",
            objects: [horizontalTemplateRoad(), directionArrow(250, 280, 0), directionArrow(755, 280, 0),
            { assetType: "car", left: 365, top: 280, direction: "east", scale: .5 },
            { assetType: "car", color: "#e17a2d", left: 500, top: 280, direction: "east", scale: .48 },
            { assetType: "truck", left: 650, top: 280, direction: "east", scale: .44 },
            collisionMarker(430, 280, .27), collisionMarker(575, 280, .27)]
        }
    };

    const reportInputs = [
        elements.reportNumber, elements.accidentDate, elements.accidentTime, elements.route, elements.run,
        elements.operatorEmployee, elements.operatorPassPrNumber, elements.busVehicleNumber,
        elements.sldManager, elements.managerPassPrNumber, elements.location, elements.preparedBy, elements.reportNotes
    ];

    function showToast(message) {
        elements.toastMessage.textContent = message;
        if (window.bootstrap) {
            toastInstance ??= new bootstrap.Toast(elements.toast, { delay: 2400 });
            toastInstance.show();
        }
    }

    function localDateTimeValue(date = new Date()) {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }

    function localDateValue(date = new Date()) { return localDateTimeValue(date).slice(0, 10); }
    function localTimeValue(date = new Date()) { return localDateTimeValue(date).slice(11, 16); }

    function safeFileName(value, fallback) {
        const cleaned = (value || "").trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
        return cleaned || fallback;
    }

    function collectReport() {
        const date = elements.accidentDate.value;
        const time = elements.accidentTime.value;
        return {
            reportNumber: elements.reportNumber.value.trim(),
            date,
            time,
            accidentDate: date ? `${date}${time ? `T${time}` : ""}` : "",
            route: elements.route.value.trim(),
            run: elements.run.value.trim(),
            operatorEmployee: elements.operatorEmployee.value.trim(),
            operatorPassPrNumber: elements.operatorPassPrNumber.value.trim(),
            busVehicleNumber: elements.busVehicleNumber.value.trim(),
            sldManager: elements.sldManager.value.trim(),
            managerPassPrNumber: elements.managerPassPrNumber.value.trim(),
            location: elements.location.value.trim(),
            preparedBy: elements.preparedBy.value.trim(),
            notes: elements.reportNotes.value.trim()
        };
    }

    function applyReport(report = {}) {
        const legacyDateTime = String(report.accidentDate || "");
        elements.reportNumber.value = report.reportNumber || "";
        elements.accidentDate.value = report.date || legacyDateTime.slice(0, 10) || localDateValue();
        elements.accidentTime.value = report.time || legacyDateTime.slice(11, 16) || localTimeValue();
        elements.route.value = report.route || "";
        elements.run.value = report.run || "";
        elements.operatorEmployee.value = report.operatorEmployee || "";
        elements.operatorPassPrNumber.value = report.operatorPassPrNumber || "";
        elements.busVehicleNumber.value = report.busVehicleNumber || "";
        elements.sldManager.value = report.sldManager || "";
        elements.managerPassPrNumber.value = report.managerPassPrNumber || "";
        elements.location.value = report.location || "";
        elements.preparedBy.value = report.preparedBy || "";
        elements.reportNotes.value = report.notes || "";
    }

    function applyMapState(map = {}) {
        mapState = {
            enabled: Boolean(map.enabled),
            address: String(map.address || ""),
            zoom: Math.min(21, Math.max(12, Number(map.zoom) || 18)),
            latitude: map.latitude != null && Number.isFinite(Number(map.latitude)) ? Number(map.latitude) : null,
            longitude: map.longitude != null && Number.isFinite(Number(map.longitude)) ? Number(map.longitude) : null
        };
        elements.blankCanvasMode.checked = !mapState.enabled;
        elements.googleMapMode.checked = mapState.enabled;
        elements.googleMapPanel.classList.toggle("d-none", !mapState.enabled);
        elements.mapAddress.value = mapState.address;
        elements.mapZoom.value = String(mapState.zoom);
    }

    function monochromeColor(value) {
        if (typeof value !== "string" || !value.trim() || value === "transparent") return value;
        try {
            return new fabric.Color(value).toGrayscale().toRgba();
        } catch {
            return value;
        }
    }

    function applySceneThemeToObject(object) {
        if (!object) return;
        const themedProperties = [
            ["fill", "themeOriginalFill"],
            ["stroke", "themeOriginalStroke"],
            ["backgroundColor", "themeOriginalBackgroundColor"]
        ];

        themedProperties.forEach(([property, originalProperty]) => {
            // Skip applying theme if user has manually overridden the color
            if (object.userColorOverride && (property === "fill" || property === "stroke")) {
                return;
            }

            if (sceneTheme === "monochrome") {
                if (!Object.prototype.hasOwnProperty.call(object, originalProperty) && typeof object[property] === "string") {
                    object[originalProperty] = object[property];
                }
                if (typeof object[originalProperty] === "string") object.set(property, monochromeColor(object[originalProperty]));
            } else if (Object.prototype.hasOwnProperty.call(object, originalProperty)) {
                object.set(property, object[originalProperty]);
                delete object[originalProperty];
            }
        });

        // Road surfaces default to a lighter opacity under the monochrome theme so
        // markings and vehicles stand out against them, then return to whatever
        // opacity they had (their own default of 100%, or a value the user set)
        // once Full Color is restored.
        if (isBaseRoad(object)) {
            if (sceneTheme === "monochrome") {
                if (!Object.prototype.hasOwnProperty.call(object, "themeOriginalOpacity")) {
                    object.themeOriginalOpacity = object.opacity ?? 1;
                }
                object.set("opacity", MONOCHROME_ROAD_OPACITY);
            } else if (Object.prototype.hasOwnProperty.call(object, "themeOriginalOpacity")) {
                object.set("opacity", object.themeOriginalOpacity);
                delete object.themeOriginalOpacity;
            }
        }

        if (object.getObjects) object.getObjects().forEach(applySceneThemeToObject);
        object.dirty = true;
    }

    function applySceneTheme() {
        canvas.getObjects().forEach(applySceneThemeToObject);
        canvas.freeDrawingBrush.color = sceneTheme === "monochrome" ? "#343a40" : "#d22f2f";
        canvas.requestRenderAll();
        updatePropertiesPanel();
    }

    function selectSceneTheme(value, applyToCanvas = true) {
        sceneTheme = value === "monochrome" ? "monochrome" : "color";
        elements.sceneTheme.value = sceneTheme;
        if (applyToCanvas) applySceneTheme();
    }

    function serializeCanvas() {
        const active = canvas.getActiveObject();
        const selectedObjects = active?.type === "activeSelection" && active.getObjects
            ? active.getObjects().slice()
            : null;

        if (selectedObjects) {
            canvas.discardActiveObject();
            selectedObjects.forEach(object => {
                if (isVehicle(object)) object.directionOfTravel = directionFromAngle(object.angle);
                syncVehicleUnitLabel(object);
            });
        }

        enforceAutomaticRoadLayering();
        const state = canvas.toJSON(SERIALIZED_PROPERTIES);

        if (selectedObjects?.length) {
            const selection = new fabric.ActiveSelection(selectedObjects, { canvas });
            canvas.setActiveObject(selection);
            selection.setCoords();
        }
        return state;
    }

    function setMapStatus(message, type = "") {
        elements.mapStatus.textContent = message;
        elements.mapStatus.classList.toggle("error", type === "error");
        elements.mapStatus.classList.toggle("success", type === "success");
    }

    function makeDocument() {
        return {
            application: "Accident Diagram Builder",
            version: 1,
            savedAtUtc: new Date().toISOString(),
            sceneTheme,
            report: collectReport(),
            map: {
                enabled: mapState.enabled,
                address: elements.mapAddress.value.trim(),
                zoom: Number(elements.mapZoom.value) || 18,
                latitude: mapState.latitude,
                longitude: mapState.longitude
            },
            canvas: serializeCanvas()
        };
    }

    function autosave() {
        try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(makeDocument())); } catch { /* Storage may be unavailable. */ }
    }

    function saveHistory() {
        if (historyLocked) return;
        const state = JSON.stringify(serializeCanvas());
        if (history[historyIndex] === state) return;
        history = history.slice(0, historyIndex + 1);
        history.push(state);
        if (history.length > 60) history.shift();
        historyIndex = history.length - 1;
        updateHistoryButtons();
        updateObjectCount();
        autosave();
    }

    function updateHistoryButtons() {
        elements.undoBtn.disabled = historyIndex <= 0;
        elements.redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function loadCanvasState(state, callback) {
        if (mapNavigationActive) leaveMapNavigationWithoutSnapshot();
        historyLocked = true;
        canvas.loadFromJSON(state, () => {
            canvas.getObjects().forEach(object => {
                normalizeRoadConnectors(object);
                // Diagrams saved before generic object locking existed only have
                // the legacy road-only "roadLocked" flag; carry it over.
                if (object.roadLocked && !object.locked) object.locked = true;
                configureSmartRoad(object);
                setObjectLocked(object, Boolean(object.locked));
            });
            migrateVehicleUnits();
            applySceneTheme();
            enforceAutomaticRoadLayering();
            mapState.enabled = Boolean(canvas.backgroundImage);
            preservedMapBackground = canvas.backgroundImage || null;
            elements.blankCanvasMode.checked = !mapState.enabled;
            elements.googleMapMode.checked = mapState.enabled;
            elements.googleMapPanel.classList.toggle("d-none", !mapState.enabled);
            canvas.renderAll();
            historyLocked = false;
            updateObjectCount();
            updatePropertiesPanel();
            callback?.();
        });
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        loadCanvasState(history[historyIndex], updateHistoryButtons);
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        loadCanvasState(history[historyIndex], updateHistoryButtons);
    }

    function resetHistory() {
        history = [];
        historyIndex = -1;
        saveHistory();
    }

    function updateObjectCount() {
        const count = canvas.getObjects().filter(object => !object.isVehicleUnitLabel).length;
        elements.objectCount.textContent = `${count} object${count === 1 ? "" : "s"}`;
    }

    function isBaseRoad(object) {
        return Boolean(object && ROAD_BASE_ASSET_TYPES.has(object.assetType));
    }

    function isRoadMarking(object) {
        return Boolean(object && ROAD_MARKING_ASSET_TYPES.has(object.assetType));
    }

    function moveLayerToBack(objects) {
        objects.slice().reverse().forEach(object => object.sendToBack());
    }

    function enforceAutomaticRoadLayering() {
        const objects = canvas.getObjects();
        const roads = objects.filter(isBaseRoad);
        const markings = objects.filter(isRoadMarking);
        // Move markings first and roads second so the final order is:
        // map background -> roads -> road markings -> all scene details.
        moveLayerToBack(markings);
        moveLayerToBack(roads);
        canvas.getObjects().filter(object => object.isVehicleUnitLabel).forEach(label => label.bringToFront());
    }

    function isSnappableRoad(object) {
        return Boolean(object && ROAD_SNAPPABLE_ASSET_TYPES.has(object.assetType));
    }

    function normalizeAngle(angle) {
        return ((Number(angle) || 0) % 360 + 360) % 360;
    }

    function configureSmartRoad(object) {
        if (!isBaseRoad(object)) return;
        object.snapAngle = ROAD_ROTATION_INCREMENT;
        object.snapThreshold = ROAD_ROTATION_THRESHOLD;
    }

    // Locking works the same way for every object type, not just roads: the
    // object stays selectable, but cannot be moved, resized, or rotated.
    function setObjectLocked(object, locked) {
        if (!object) return;
        const isLockedValue = Boolean(locked);
        object.locked = isLockedValue;
        object.set({
            lockMovementX: isLockedValue,
            lockMovementY: isLockedValue,
            lockScalingX: isLockedValue,
            lockScalingY: isLockedValue,
            lockRotation: isLockedValue,
            lockSkewingX: isLockedValue,
            lockSkewingY: isLockedValue,
            hasControls: !isLockedValue,
            selectable: true,
            evented: true,
            hoverCursor: isLockedValue ? "not-allowed" : "move"
        });
        object.setCoords();
    }

    function isLocked(object) {
        return Boolean(object && object.locked);
    }

    function snapRoadRotation(object, force = false) {
        if (!isBaseRoad(object) || object.locked) return false;
        const current = normalizeAngle(object.angle);
        const snapped = (Math.round(current / ROAD_ROTATION_INCREMENT) * ROAD_ROTATION_INCREMENT) % 360;
        const difference = Math.min(Math.abs(current - snapped), 360 - Math.abs(current - snapped));
        if (!force && difference > ROAD_ROTATION_THRESHOLD) return false;
        if (difference < .01) {
            object._roadRotationSnapNotice = snapped;
            return true;
        }
        object.rotate(snapped);
        object.setCoords();
        object._roadRotationSnapNotice = snapped;
        return true;
    }

    function roadConnectorDefinitions(object) {
        // Every child rect carries Fabric's default (invisible) 1px strokeWidth,
        // which Fabric still factors into each child's bounding rect when it lays
        // out the group — inflating the reported width/height by 1px versus the
        // shape's true fill geometry. That's invisible for the symmetric ±half
        // connectors below (absorbed by the endpoint overlap), but asset types
        // whose connector position also depends on half-width/half-height for the
        // perpendicular axis (L-road, T-junction) need the true value or the
        // connector ends up perceptibly off-center.
        const halfWidth = (Number(object.width) - 1) / 2;
        const halfHeight = (Number(object.height) - 1) / 2;
        switch (object.assetType) {
            case "road-horizontal":
                return [{ x: -halfWidth, y: 0, dx: -1, dy: 0 }, { x: halfWidth, y: 0, dx: 1, dy: 0 }];
            case "road-vertical":
                return [{ x: 0, y: -halfHeight, dx: 0, dy: -1 }, { x: 0, y: halfHeight, dx: 0, dy: 1 }];
            case "intersection":
                return [
                    { x: -halfWidth, y: 0, dx: -1, dy: 0 }, { x: halfWidth, y: 0, dx: 1, dy: 0 },
                    { x: 0, y: -halfHeight, dx: 0, dy: -1 }, { x: 0, y: halfHeight, dx: 0, dy: 1 }
                ];
            case "l-road":
                // The horizontal arm's far end sits flush against the bounding
                // box's right edge, at the arm's own centerline (64px in from the
                // top, since the arm is 128px tall). The vertical arm's far end
                // mirrors this against the bottom edge.
                return [
                    { x: halfWidth, y: -halfHeight + 64, dx: 1, dy: 0 },
                    { x: -halfWidth + 64, y: halfHeight, dx: 0, dy: 1 }
                ];
            case "t-junction": {
                // The crossbar is 128px tall (half-height 64) and sits flush against
                // the top of the group's bounding box, so its centerline is 64px
                // below the top edge, not 54 (that was the intersection piece's
                // unrelated road-edge inset, copied here by mistake).
                const crossbarY = -halfHeight + 64;
                return [
                    { x: -halfWidth, y: crossbarY, dx: -1, dy: 0 },
                    { x: halfWidth, y: crossbarY, dx: 1, dy: 0 },
                    { x: 0, y: halfHeight, dx: 0, dy: 1 }
                ];
            }
            default:
                return [];
        }
    }

    function roadConnectors(object) {
        const matrix = object.calcTransformMatrix();
        return roadConnectorDefinitions(object).map(connector => {
            const point = fabric.util.transformPoint(new fabric.Point(connector.x, connector.y), matrix);
            const vectorX = matrix[0] * connector.dx + matrix[2] * connector.dy;
            const vectorY = matrix[1] * connector.dx + matrix[3] * connector.dy;
            const length = Math.hypot(vectorX, vectorY) || 1;
            return { point, direction: { x: vectorX / length, y: vectorY / length } };
        });
    }

    function snapRoadToNearbyEndpoint(movingRoad) {
        if (!isSnappableRoad(movingRoad) || movingRoad.locked || movingRoad.group) return false;
        const movingConnectors = roadConnectors(movingRoad);
        const targetRoads = canvas.getObjects().filter(object => object !== movingRoad && isSnappableRoad(object));
        let bestMatch = null;

        targetRoads.forEach(targetRoad => {
            roadConnectors(targetRoad).forEach(targetConnector => {
                movingConnectors.forEach(movingConnector => {
                    const alignment = movingConnector.direction.x * targetConnector.direction.x + movingConnector.direction.y * targetConnector.direction.y;
                    if (alignment > -.7) return;
                    const distance = Math.hypot(
                        targetConnector.point.x - movingConnector.point.x,
                        targetConnector.point.y - movingConnector.point.y
                    );
                    if (distance <= ROAD_ENDPOINT_SNAP_DISTANCE && (!bestMatch || distance < bestMatch.distance)) {
                        bestMatch = { distance, movingConnector, targetConnector, targetRoad };
                    }
                });
            });
        });

        if (!bestMatch) return false;
        movingRoad.set({
            // Continue slightly past the matching endpoint. The overlap hides
            // anti-aliased background pixels that otherwise look like a white
            // border where two independently rendered road surfaces meet.
            left: movingRoad.left + bestMatch.targetConnector.point.x - bestMatch.movingConnector.point.x
                + bestMatch.movingConnector.direction.x * ROAD_ENDPOINT_OVERLAP,
            top: movingRoad.top + bestMatch.targetConnector.point.y - bestMatch.movingConnector.point.y
                + bestMatch.movingConnector.direction.y * ROAD_ENDPOINT_OVERLAP
        });
        movingRoad.setCoords();
        movingRoad._roadEndpointSnapNotice = bestMatch.targetRoad.displayName || "road";
        return true;
    }

    function setAllRoadLocks(locked) {
        const roads = canvas.getObjects().filter(isBaseRoad);
        roads.forEach(road => setObjectLocked(road, locked));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
        showToast(roads.length
            ? `${roads.length} road${roads.length === 1 ? "" : "s"} ${locked ? "locked" : "unlocked"}`
            : "There are no roads to update");
    }

    function isVehicle(object) {
        return Boolean(object && (object.isVehicle || VEHICLE_ASSET_TYPES.has(object.assetType)));
    }

    function vehicleObjects() {
        return canvas.getObjects().filter(isVehicle);
    }

    function nextVehicleUnitNumber() {
        const usedNumbers = new Set(vehicleObjects()
            .map(object => Number(object.vehicleUnitNumber))
            .filter(number => Number.isInteger(number) && number > 0));
        for (let number = 1; number <= 999; number++) {
            if (!usedNumbers.has(number)) return number;
        }
        return 999;
    }

    function nextVehicleId() {
        let id;
        do { id = `vehicle-${Date.now()}-${vehicleIdSequence++}`; }
        while (canvas.getObjects().some(object => object.vehicleId === id || object.parentVehicleId === id));
        return id;
    }

    function findVehicleUnitLabel(vehicle) {
        if (!vehicle?.vehicleId) return null;
        return canvas.getObjects().find(object => object.isVehicleUnitLabel && object.parentVehicleId === vehicle.vehicleId) || null;
    }

    function directionBadgeText(vehicle) {
        if (vehicle.directionOfTravel === "custom") {
            const angle = ((Math.round(Number(vehicle.angle) || 0) % 360) + 360) % 360;
            return `${angle}°`;
        }
        return VEHICLE_DIRECTIONS[vehicle.directionOfTravel]?.shortLabel || "";
    }

    function vehicleUnitLabelText(vehicle) {
        const unit = `Unit ${vehicle.vehicleUnitNumber}`;
        const direction = directionBadgeText(vehicle);
        return direction ? `${unit}  •  ${direction}` : unit;
    }

    function createVehicleUnitLabel(vehicle) {
        return new fabric.Text(vehicleUnitLabelText(vehicle), {
            left: 0,
            top: 0,
            originX: "left",
            originY: "center",
            fill: "#172033",
            backgroundColor: "rgba(255,255,255,.90)",
            fontFamily: "Arial",
            fontSize: 18,
            fontWeight: "700",
            padding: 5,
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            objectCaching: false,
            assetType: "vehicle-unit-label",
            displayName: "Vehicle unit label",
            isVehicleUnitLabel: true,
            parentVehicleId: vehicle.vehicleId
        });
    }

    function positionVehicleUnitLabel(vehicle, label) {
        if (!vehicle || !label) return;
        label.set("text", vehicleUnitLabelText(vehicle));
        label.initDimensions?.();
        const bounds = vehicle.getBoundingRect(true, true);
        const labelWidth = label.getScaledWidth();
        let left = bounds.left + bounds.width + 10;
        if (left + labelWidth > CANVAS_WIDTH - 4) left = Math.max(4, bounds.left - labelWidth - 10);
        const top = Math.max(14, Math.min(CANVAS_HEIGHT - 14, bounds.top + Math.min(26, bounds.height / 2)));
        label.set({ left, top, opacity: vehicle.opacity ?? 1 });
        label.setCoords();
    }

    function ensureVehicleMetadata(vehicle, forceNewUnit = false) {
        if (!isVehicle(vehicle)) return null;
        vehicle.isVehicle = true;
        if (!vehicle.vehicleId || forceNewUnit) vehicle.vehicleId = nextVehicleId();
        if (forceNewUnit || !Number.isInteger(Number(vehicle.vehicleUnitNumber)) || Number(vehicle.vehicleUnitNumber) < 1) {
            vehicle.vehicleUnitNumber = nextVehicleUnitNumber();
        } else {
            vehicle.vehicleUnitNumber = Math.min(999, Math.round(Number(vehicle.vehicleUnitNumber)));
        }
        if (!(vehicle.directionOfTravel in VEHICLE_DIRECTIONS) && vehicle.directionOfTravel !== "custom") {
            vehicle.directionOfTravel = "";
        }
        return vehicle;
    }

    function ensureVehicleUnitLabel(vehicle) {
        ensureVehicleMetadata(vehicle);
        let label = findVehicleUnitLabel(vehicle);
        if (!label) {
            label = createVehicleUnitLabel(vehicle);
            canvas.add(label);
        }
        positionVehicleUnitLabel(vehicle, label);
        label.bringToFront();
        return label;
    }

    function syncVehicleUnitLabel(vehicle) {
        if (!isVehicle(vehicle)) return;
        const label = findVehicleUnitLabel(vehicle);
        if (label) positionVehicleUnitLabel(vehicle, label);
    }

    function syncVehicleLabelsForTarget(target) {
        if (isVehicle(target)) {
            syncVehicleUnitLabel(target);
            return;
        }
        if (target?.type === "activeSelection" && target.getObjects) {
            target.getObjects().forEach(syncVehicleUnitLabel);
        }
    }

    function removeVehicleUnitLabel(vehicle) {
        const label = findVehicleUnitLabel(vehicle);
        if (label) canvas.remove(label);
    }

    function migrateVehicleUnits() {
        const vehicleIds = new Set();
        vehicleObjects().forEach(vehicle => {
            if (!vehicle.vehicleId || vehicleIds.has(vehicle.vehicleId)) vehicle.vehicleId = nextVehicleId();
            vehicleIds.add(vehicle.vehicleId);
            ensureVehicleMetadata(vehicle);
            ensureVehicleUnitLabel(vehicle);
        });
        canvas.getObjects()
            .filter(object => object.isVehicleUnitLabel && !vehicleIds.has(object.parentVehicleId))
            .forEach(label => canvas.remove(label));
    }

    function directionFromAngle(angle) {
        const normalized = ((Math.round(Number(angle) || 0) % 360) + 360) % 360;
        const match = Object.entries(VEHICLE_DIRECTIONS)
            .find(([, value]) => value.angle !== null && value.angle === normalized);
        return match?.[0] || "custom";
    }

    function commonOptions(name, assetType, left, top) {
        return {
            left, top,
            originX: "center", originY: "center",
            assetType,
            displayName: name
        };
    }

    function rect(options, colorable = false) {
        const object = new fabric.Rect(options);
        object.colorable = colorable;
        return object;
    }

    function circle(options, colorable = false) {
        const object = new fabric.Circle(options);
        object.colorable = colorable;
        return object;
    }

    function line(points, options) {
        return new fabric.Line(points, { strokeLineCap: "round", ...options });
    }

    function group(items, name, assetType, left, top, options = {}) {
        return new fabric.Group(items, { ...commonOptions(name, assetType, left, top), ...options });
    }

    function dashedCenterLines(width, horizontal = true) {
        const items = [];
        for (let position = -width / 2 + 22; position < width / 2 - 10; position += 38) {
            items.push(horizontal
                ? rect({ left: position, top: 0, width: 22, height: 3, fill: "#f8d94f", originX: "center", originY: "center", selectable: false })
                : rect({ left: 0, top: position, width: 3, height: 22, fill: "#f8d94f", originX: "center", originY: "center", selectable: false }));
        }
        return items;
    }

    function roadEdge(points) {
        return line(points, { stroke: "#f5f7fa", strokeWidth: 3, strokeLineCap: "butt" });
    }

    function normalizeRoadConnectors(object) {
        if (!object || !["road-horizontal", "road-vertical", "intersection", "t-junction"].includes(object.assetType)) return;
        const children = typeof object.getObjects === "function" ? object.getObjects() : [];
        children.forEach(child => {
            // Remove the old dark rectangular outline from road surfaces loaded
            // from autosave or an earlier JSON diagram.
            if (child.type === "rect" &&
                (String(child.fill).toLowerCase() === "#5b6570" || String(child.stroke).toLowerCase() === "#343c44")) {
                child.set({ stroke: null, strokeWidth: 0 });
            }
            // Earlier T-junctions had a short white line closing the extendable
            // stem. Hide that legacy end cap when an old diagram is opened.
            if (object.assetType === "t-junction" && child.type === "line" &&
                String(child.stroke).toLowerCase() === "#f5f7fa" &&
                Math.abs(Number(child.y1) - Number(child.y2)) < 0.1 &&
                Number(child.width) < 130 && Number(child.top) > 140) {
                child.set("visible", false);
            }
        });
        object.dirty = true;
        object.setCoords();
    }

    function createRoad(horizontal, left, top) {
        const long = 470;
        const short = 128;
        const items = [
            // Road surfaces intentionally have no rectangular stroke. A stroke would
            // draw a visible cap across each connector end when road pieces touch.
            rect({ left: 0, top: 0, width: horizontal ? long : short, height: horizontal ? short : long, fill: "#5b6570", originX: "center", originY: "center" }, true),
            horizontal ? roadEdge([-long / 2, -short / 2 + 10, long / 2, -short / 2 + 10]) : roadEdge([-short / 2 + 10, -long / 2, -short / 2 + 10, long / 2]),
            horizontal ? roadEdge([-long / 2, short / 2 - 10, long / 2, short / 2 - 10]) : roadEdge([short / 2 - 10, -long / 2, short / 2 - 10, long / 2]),
            ...dashedCenterLines(long, horizontal)
        ];
        return group(items, horizontal ? "Straight road" : "Vertical road", horizontal ? "road-horizontal" : "road-vertical", left, top, { lockUniScaling: true });
    }

    function createIntersection(left, top) {
        const halfLength = 250;
        const edge = 54;
        const items = [
            rect({ left: 0, top: 0, width: 500, height: 128, fill: "#5b6570", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: 0, width: 128, height: 500, fill: "#5b6570", originX: "center", originY: "center" }, true),
            // Draw only roadside edges. Keeping the four arm ends open lets a
            // straight or vertical road overlap without a black/white seam.
            roadEdge([-halfLength, -edge, -edge, -edge]),
            roadEdge([edge, -edge, halfLength, -edge]),
            roadEdge([-halfLength, edge, -edge, edge]),
            roadEdge([edge, edge, halfLength, edge]),
            roadEdge([-edge, -halfLength, -edge, -edge]),
            roadEdge([-edge, edge, -edge, halfLength]),
            roadEdge([edge, -halfLength, edge, -edge]),
            roadEdge([edge, edge, edge, halfLength]),
            ...dashedCenterLines(500, true), ...dashedCenterLines(500, false)
        ];
        return group(items, "Intersection", "intersection", left, top, { lockUniScaling: true });
    }

    function createTJunction(left, top) {
        const items = [
            rect({ left: 0, top: -125, width: 500, height: 128, fill: "#5b6570", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: 35, width: 128, height: 320, fill: "#5b6570", originX: "center", originY: "center" }, true),
            roadEdge([-250, -179, 250, -179]),
            roadEdge([-250, -71, -64, -71]),
            roadEdge([64, -71, 250, -71]),
            roadEdge([-54, -71, -54, 195]),
            roadEdge([54, -71, 54, 195])
            // No closing line at the bottom: this is an open connector for a
            // vertical road extension.
        ];
        for (let x = -220; x <= 220; x += 42) items.push(rect({ left: x, top: -125, width: 24, height: 3, fill: "#f8d94f", originX: "center", originY: "center" }));
        for (let y = -45; y <= 165; y += 42) items.push(rect({ left: 0, top: y, width: 3, height: 24, fill: "#f8d94f", originX: "center", originY: "center" }));
        return group(items, "T-Intersection road", "t-junction", left, top, { lockUniScaling: true });
    }

    function createLRoad(left, top) {
        const long = 320;
        const short = 128;
        const items = [
            // Horizontal part of the L
            rect({ left: long / 2, top: 0, width: long, height: short, fill: "#5b6570", originX: "center", originY: "center" }, true),
            // Vertical part of the L
            rect({ left: 0, top: long / 2, width: short, height: long, fill: "#5b6570", originX: "center", originY: "center" }, true),
            // Corner fill - the two strips above only overlap in one quadrant of
            // the elbow, leaving the outer corner unpaved. This closes that gap
            // so the bend is a solid, continuous road surface.
            rect({ left: 0, top: 0, width: short, height: short, fill: "#5b6570", originX: "center", originY: "center" }, true),
            // Road edges - horizontal part (outer edge now spans the full corner)
            roadEdge([-short / 2 + 10, -short / 2 + 10, long, -short / 2 + 10]),
            roadEdge([short / 2 - 10, short / 2 - 10, long, short / 2 - 10]),
            // Road edges - vertical part (outer edge now spans the full corner)
            roadEdge([-short / 2 + 10, -short / 2 + 10, -short / 2 + 10, long]),
            roadEdge([short / 2 - 10, short / 2 - 10, short / 2 - 10, long])
        ];

        // Dashed center lines - horizontal part
        for (let position = 22; position < long - 10; position += 38) {
            items.push(rect({ left: position, top: 0, width: 22, height: 3, fill: "#f8d94f", originX: "center", originY: "center", selectable: false }));
        }

        // Dashed center lines - vertical part
        for (let position = short / 2 - 10 + 22; position < long - 10; position += 38) {
            items.push(rect({ left: 0, top: position, width: 3, height: 22, fill: "#f8d94f", originX: "center", originY: "center", selectable: false }));
        }

        return group(items, "L-shaped road", "l-road", left, top, { lockUniScaling: true });
    }

    function createCrosswalk(left, top) {
        const items = [];
        for (let x = -80; x <= 80; x += 24) items.push(rect({ left: x, top: 0, width: 13, height: 85, fill: "#f8fafc", stroke: "#cad0d8", strokeWidth: 1, originX: "center", originY: "center" }, true));
        return group(items, "Crosswalk", "crosswalk", left, top);
    }

    function createFourWayCrosswalk(left, top) {
        const items = [];
        const armOffset = 118;
        for (let offset = -72; offset <= 72; offset += 24) {
            const stripeOptions = { fill: "#f8fafc", stroke: "#cad0d8", strokeWidth: 1, originX: "center", originY: "center" };
            items.push(rect({ left: offset, top: -armOffset, width: 13, height: 70, ...stripeOptions }, true));
            items.push(rect({ left: offset, top: armOffset, width: 13, height: 70, ...stripeOptions }, true));
            items.push(rect({ left: -armOffset, top: offset, width: 70, height: 13, ...stripeOptions }, true));
            items.push(rect({ left: armOffset, top: offset, width: 70, height: 13, ...stripeOptions }, true));
        }
        return group(items, "Four-Way Crosswalk", "four-way-crosswalk", left, top);
    }

    function createCar(name, type, color, left, top, scale = 1) {
        const width = type === "truck" ? 88 : 74;
        const length = type === "truck" ? 190 : 145;
        const wheelX = width / 2 + 3;
        const wheelY = length * .28;
        const items = [
            rect({ left: -wheelX, top: -wheelY, width: 12, height: 32, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: wheelX, top: -wheelY, width: 12, height: 32, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: -wheelX, top: wheelY, width: 12, height: 32, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: wheelX, top: wheelY, width: 12, height: 32, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 0, top: 0, width, height: length, rx: type === "truck" ? 10 : 25, fill: color, stroke: "#263241", strokeWidth: 3, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: type === "truck" ? -66 : -35, width: width - 18, height: type === "truck" ? 35 : 34, rx: 6, fill: "#cbe5f0", stroke: "#334155", strokeWidth: 2, originX: "center", originY: "center" }),
            rect({ left: 0, top: type === "truck" ? 35 : 30, width: width - 20, height: type === "truck" ? 92 : 50, rx: type === "truck" ? 4 : 10, fill: type === "truck" ? color : "rgba(203,229,240,.72)", stroke: "#334155", strokeWidth: 2, originX: "center", originY: "center" }),
            rect({ left: -width * .27, top: -length / 2 + 7, width: 13, height: 7, rx: 2, fill: "#fff1a8", originX: "center", originY: "center" }),
            rect({ left: width * .27, top: -length / 2 + 7, width: 13, height: 7, rx: 2, fill: "#fff1a8", originX: "center", originY: "center" }),
            rect({ left: -width * .27, top: length / 2 - 7, width: 13, height: 7, rx: 2, fill: "#d43a3a", originX: "center", originY: "center" }),
            rect({ left: width * .27, top: length / 2 - 7, width: 13, height: 7, rx: 2, fill: "#d43a3a", originX: "center", originY: "center" })
        ];
        return group(items, `${name} ${objectSequence++}`, type, left, top, { scaleX: scale, scaleY: scale });
    }

    function createMotorcycle(left, top) {
        return group([
            circle({ left: 0, top: -48, radius: 18, fill: "transparent", stroke: "#1f2937", strokeWidth: 7, originX: "center", originY: "center" }),
            circle({ left: 0, top: 48, radius: 18, fill: "transparent", stroke: "#1f2937", strokeWidth: 7, originX: "center", originY: "center" }),
            rect({ left: 0, top: 0, width: 27, height: 78, rx: 12, fill: "#cc3d3d", stroke: "#263241", strokeWidth: 2, originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -12, radius: 11, fill: "#313b47", stroke: "#111827", strokeWidth: 2, originX: "center", originY: "center" }),
            line([-26, -24, 26, -24], { stroke: "#263241", strokeWidth: 6 }),
            rect({ left: 0, top: 34, width: 20, height: 28, rx: 8, fill: "#202832", originX: "center", originY: "center" })
        ], `Motorcycle ${objectSequence++}`, "motorcycle", left, top);
    }

    function createDoNotEnter(left, top) {
        return group([
            rect({ left: 0, top: 40, width: 8, height: 86, fill: "#7b8794", originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -25, radius: 34, fill: "#d62f2f", stroke: "#fff", strokeWidth: 4, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -25, width: 47, height: 12, rx: 2, fill: "#fff", originX: "center", originY: "center" })
        ], "Do Not Enter sign", "do-not-enter", left, top);
    }

    function createNoParking(left, top) {
        return group([
            rect({ left: 0, top: 43, width: 8, height: 82, fill: "#7b8794", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -24, width: 58, height: 76, rx: 3, fill: "#fff", stroke: "#243448", strokeWidth: 3, originX: "center", originY: "center" }, true),
            new fabric.Text("P", { left: 0, top: -24, fill: "#1f4fa3", fontSize: 43, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" }),
            line([-22, -50, 22, 2], { stroke: "#d52d2d", strokeWidth: 7 })
        ], "No Parking sign", "no-parking", left, top);
    }

    function createNoTurn(left, top) {
        const turnArrow = new fabric.Path("M -18 14 L -18 -4 Q -18 -24 4 -24 L 14 -24 M 5 -34 L 16 -24 L 5 -14", { fill: "", stroke: "#202a34", strokeWidth: 6, strokeLineCap: "round", strokeLineJoin: "round", originX: "center", originY: "center", left: 0, top: -25 });
        return group([
            rect({ left: 0, top: 42, width: 8, height: 84, fill: "#7b8794", originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -25, radius: 35, fill: "#fff", stroke: "#d52d2d", strokeWidth: 6, originX: "center", originY: "center" }, true),
            turnArrow,
            line([-24, -50, 24, 0], { stroke: "#d52d2d", strokeWidth: 7 })
        ], "No Turn sign", "no-turn", left, top);
    }

    function warningSign(symbol, name, assetType, left, top) {
        const diamond = rect({ left: 0, top: -22, width: 72, height: 72, angle: 45, fill: "#f6c943", stroke: "#202a34", strokeWidth: 3, originX: "center", originY: "center" }, true);
        return group([
            rect({ left: 0, top: 48, width: 8, height: 86, fill: "#7b8794", originX: "center", originY: "center" }, true),
            diamond,
            new fabric.Text(symbol, { left: 0, top: -22, fill: "#151b22", fontSize: symbol.length > 2 ? 15 : 34, fontWeight: "800", fontFamily: "Arial", textAlign: "center", originX: "center", originY: "center" })
        ], name, assetType, left, top);
    }

    function createCurveWarning(left, top) { return warningSign("↝", "Curve warning sign", "curve-warning", left, top); }
    function createSlipperyWarning(left, top) { return warningSign("〰", "Slippery Road sign", "slippery-road", left, top); }
    function createSchoolCrossing(left, top) { return warningSign("SCHOOL", "School Crossing sign", "school-crossing", left, top); }
    function createConstructionSign(left, top) { return warningSign("WORK", "Construction sign", "construction-sign", left, top); }
    function createIntersectionWarning(left, top) { return warningSign("+", "Intersection warning sign", "intersection-warning", left, top); }
    function createMergeWarning(left, top) { return warningSign("MERGE", "Merge warning sign", "merge-warning", left, top); }
    function createLaneEndsWarning(left, top) { return warningSign("LANE\nENDS", "Lane Ends sign", "lane-ends", left, top); }
    function createPedestrianCrossing(left, top) { return warningSign("PED", "Pedestrian Crossing sign", "pedestrian-crossing", left, top); }

    function createOneWay(left, top) {
        const arrow = new fabric.Polygon([{ x: -50, y: -7 }, { x: 20, y: -7 }, { x: 20, y: -18 }, { x: 51, y: 0 }, { x: 20, y: 18 }, { x: 20, y: 7 }, { x: -50, y: 7 }], { left: 0, top: -15, fill: "#fff", originX: "center", originY: "center" });
        return group([
            rect({ left: 0, top: 50, width: 8, height: 92, fill: "#778390", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -24, width: 150, height: 78, rx: 4, fill: "#151a20", stroke: "#fff", strokeWidth: 3, originX: "center", originY: "center" }, true),
            arrow,
            new fabric.Text("ONE WAY", { left: 0, top: -48, fill: "#fff", fontSize: 16, fontWeight: "900", fontFamily: "Arial", charSpacing: 45, originX: "center", originY: "center" })
        ], "One Way sign", "one-way", left, top);
    }

    function createRailroadCrossing(left, top) {
        return group([
            rect({ left: 0, top: 42, width: 8, height: 115, fill: "#778390", originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -28, radius: 38, fill: "#fff", stroke: "#242b33", strokeWidth: 3, originX: "center", originY: "center" }, true),
            line([-25, -53, 25, -3], { stroke: "#242b33", strokeWidth: 7 }),
            line([25, -53, -25, -3], { stroke: "#242b33", strokeWidth: 7 }),
            new fabric.Text("R R", { left: 0, top: -28, fill: "#242b33", fontSize: 12, fontWeight: "900", fontFamily: "Arial", backgroundColor: "#fff", originX: "center", originY: "center" })
        ], "Railroad Crossing sign", "railroad-crossing", left, top);
    }

    function createRouteMarker(left, top) {
        return group([
            rect({ left: 0, top: 45, width: 8, height: 90, fill: "#778390", originX: "center", originY: "center" }, true),
            new fabric.Polygon([{ x: -33, y: -55 }, { x: 33, y: -55 }, { x: 38, y: -36 }, { x: 31, y: 5 }, { x: 0, y: 26 }, { x: -31, y: 5 }, { x: -38, y: -36 }], { left: 0, top: -26, fill: "#fff", stroke: "#202a34", strokeWidth: 3, originX: "center", originY: "center" }, true),
            new fabric.Text("US\n1", { left: 0, top: -27, fill: "#111", fontSize: 20, lineHeight: .85, textAlign: "center", fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Route Marker", "route-marker", left, top);
    }

    function createExitSign(left, top) {
        return group([
            rect({ left: 0, top: 42, width: 8, height: 88, fill: "#778390", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -25, width: 145, height: 66, rx: 4, fill: "#217346", stroke: "#fff", strokeWidth: 3, originX: "center", originY: "center" }, true),
            new fabric.Text("EXIT", { left: 0, top: -25, fill: "#fff", fontSize: 24, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Exit sign", "exit-sign", left, top);
    }

    function createDetourSign(left, top) {
        return group([
            rect({ left: 0, top: 42, width: 8, height: 88, fill: "#778390", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -25, width: 150, height: 60, fill: "#f08a24", stroke: "#202a34", strokeWidth: 3, originX: "center", originY: "center" }, true),
            new fabric.Text("DETOUR  →", { left: 0, top: -25, fill: "#111", fontSize: 20, fontWeight: "900", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Detour sign", "detour-sign", left, top);
    }

    function createStreetName(left, top) {
        const streetText = new fabric.Text("MAIN ST", { left: 0, top: -26, fill: "#fff", fontSize: 19, fontWeight: "700", fontFamily: "Arial", originX: "center", originY: "center" });
        streetText.editableTextRole = "street-name";
        return group([
            rect({ left: 0, top: 40, width: 8, height: 105, fill: "#778390", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -26, width: 150, height: 42, rx: 4, fill: "#237346", stroke: "#fff", strokeWidth: 3, originX: "center", originY: "center" }, true),
            streetText
        ], "Street Name sign", "street-name", left, top);
    }

    function createStopLine(left, top) {
        return group([
            rect({ left: 0, top: 0, width: 190, height: 18, fill: "#fff", stroke: "#b8bec6", strokeWidth: 1, originX: "center", originY: "center" }, true),
            new fabric.Text("STOP", { left: 0, top: 34, fill: "#fff", stroke: "#777", strokeWidth: .3, fontSize: 28, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Stop line", "stop-line", left, top);
    }

    function createSidewalk(left, top) {
        const items = [rect({ left: 0, top: 0, width: 360, height: 70, fill: "#c9c7c1", stroke: "#77746e", strokeWidth: 3, originX: "center", originY: "center" }, true)];
        for (let x = -135; x <= 135; x += 90) items.push(line([x, -34, x, 34], { stroke: "#96938d", strokeWidth: 2 }));
        return group(items, "Sidewalk", "sidewalk", left, top);
    }

    function createDriveway(left, top) {
        return group([
            rect({ left: 0, top: 0, width: 190, height: 100, fill: "#777f86", stroke: "#3f474e", strokeWidth: 3, originX: "center", originY: "center" }, true),
            line([-95, -49, 95, -49], { stroke: "#f2f2f2", strokeWidth: 4 }),
            line([-95, 49, 95, 49], { stroke: "#f2f2f2", strokeWidth: 4 })
        ], "Driveway", "driveway", left, top);
    }

    function createRoadLine(dashed, left, top) {
        const items = dashed
            ? Array.from({ length: 6 }, (_, index) => rect({ left: -125 + index * 50, top: 0, width: 30, height: 8, fill: "#fff", stroke: "#aeb4bc", strokeWidth: 1, originX: "center", originY: "center" }, true))
            : [rect({ left: 0, top: 0, width: 290, height: 9, fill: "#fff", stroke: "#aeb4bc", strokeWidth: 1, originX: "center", originY: "center" }, true)];
        return group(items, dashed ? "Dashed Road Line" : "Solid Road Line", dashed ? "dashed-line" : "solid-line", left, top);
    }

    function createTurnLane(left, top) {
        const pavementArrow = new fabric.Path("M 0 55 L 0 -15 Q 0 -45 34 -45 L 50 -45 M 37 -58 L 53 -45 L 37 -31", { left: 0, top: 2, fill: "", stroke: "#fff", strokeWidth: 12, strokeLineCap: "round", strokeLineJoin: "round", originX: "center", originY: "center" });
        return group([
            rect({ left: 0, top: 0, width: 105, height: 230, fill: "#5b6570", stroke: "#343c44", strokeWidth: 3, originX: "center", originY: "center" }, true),
            line([-47, -114, -47, 114], { stroke: "#fff", strokeWidth: 4 }), line([47, -114, 47, 114], { stroke: "#fff", strokeWidth: 4 }),
            pavementArrow,
            new fabric.Text("ONLY", { left: 0, top: 77, fill: "#fff", fontSize: 22, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Right Turn Lane", "turn-lane", left, top);
    }

    function createTrafficCone(left, top) {
        const cone = new fabric.Triangle({ left: 0, top: -7, width: 52, height: 82, fill: "#f27822", stroke: "#a9430c", strokeWidth: 2, originX: "center", originY: "center" });
        cone.colorable = true;
        return group([cone, rect({ left: 0, top: 2, width: 34, height: 10, fill: "#fff", originX: "center", originY: "center" }), rect({ left: 0, top: 39, width: 72, height: 14, rx: 3, fill: "#2e343a", originX: "center", originY: "center" })], "Traffic Cone", "traffic-cone", left, top);
    }

    function createBarricade(left, top) {
        return group([
            line([-66, 14, -82, 70], { stroke: "#555d66", strokeWidth: 9 }), line([66, 14, 82, 70], { stroke: "#555d66", strokeWidth: 9 }),
            rect({ left: 0, top: -12, width: 190, height: 44, fill: "#fff", stroke: "#343b43", strokeWidth: 2, originX: "center", originY: "center" }, true),
            ...[-70, -20, 30, 80].map(x => new fabric.Polygon([{ x: -17, y: -22 }, { x: 2, y: -22 }, { x: 17, y: 22 }, { x: -2, y: 22 }], { left: x, top: -12, fill: "#e46b20", originX: "center", originY: "center" }))
        ], "Barricade", "barricade", left, top);
    }

    function createGuardrail(left, top) {
        const items = [rect({ left: 0, top: 0, width: 310, height: 22, rx: 7, fill: "#aeb7c0", stroke: "#59636d", strokeWidth: 3, originX: "center", originY: "center" }, true)];
        [-125, -42, 42, 125].forEach(x => items.push(rect({ left: x, top: 29, width: 10, height: 58, fill: "#737d87", originX: "center", originY: "center" }, true)));
        return group(items, "Guardrail", "guardrail", left, top);
    }

    function createFlashingLight(left, top) {
        const rays = [];
        for (let angle = 0; angle < 360; angle += 45) {
            const radians = angle * Math.PI / 180;
            rays.push(line([Math.cos(radians) * 35, Math.sin(radians) * 35 - 18, Math.cos(radians) * 53, Math.sin(radians) * 53 - 18], { stroke: "#f2a516", strokeWidth: 5 }));
        }
        return group([
            ...rays,
            rect({ left: 0, top: 24, width: 62, height: 22, rx: 4, fill: "#333b44", originX: "center", originY: "center" }, true),
            new fabric.Triangle({ left: 0, top: -13, width: 55, height: 68, fill: "#f7b52c", stroke: "#b86d08", strokeWidth: 3, originX: "center", originY: "center" })
        ], "Flashing Warning Light", "flashing-light", left, top);
    }

    function createCollisionPoint(left, top) {
        const burst = new fabric.Polygon([{ x: 0, y: -55 }, { x: 13, y: -20 }, { x: 46, y: -40 }, { x: 25, y: -8 }, { x: 60, y: 4 }, { x: 22, y: 14 }, { x: 39, y: 49 }, { x: 8, y: 27 }, { x: -8, y: 58 }, { x: -15, y: 24 }, { x: -53, y: 40 }, { x: -29, y: 8 }, { x: -60, y: -8 }, { x: -22, y: -15 }], { fill: "#ef4444", stroke: "#991b1b", strokeWidth: 3, originX: "center", originY: "center", ...commonOptions("Collision Point", "collision-point", left, top) });
        burst.colorable = true;
        return burst;
    }

    function createDebris(left, top) {
        const pieces = [[-48, -18, 14], [-15, 20, 10], [18, -24, 13], [47, 15, 9], [4, 40, 7]].map(([x, y, size], index) => new fabric.Polygon([{ x: -size, y: -size / 2 }, { x: size / 2, y: -size }, { x: size, y: size / 3 }, { x: -size / 3, y: size }], { left: x, top: y, angle: index * 17, fill: index % 2 ? "#4b5563" : "#8b5e3c", stroke: "#2d333b", strokeWidth: 1, originX: "center", originY: "center" }));
        return group(pieces, "Debris", "debris", left, top);
    }

    function createSkidMarks(left, top) {
        return group([
            new fabric.Path("M -105 -18 C -45 -26 20 -4 105 8", { fill: "", stroke: "#20242a", strokeWidth: 9, strokeLineCap: "round" }),
            new fabric.Path("M -105 18 C -45 10 20 32 105 44", { fill: "", stroke: "#20242a", strokeWidth: 9, strokeLineCap: "round" })
        ], "Skid Marks", "skid-marks", left, top);
    }

    function createSpecialArrow(name, assetType, color, left, top, dashed = false) {
        const arrow = new fabric.Polygon([{ x: -82, y: -11 }, { x: 30, y: -11 }, { x: 30, y: -28 }, { x: 82, y: 0 }, { x: 30, y: 28 }, { x: 30, y: 11 }, { x: -82, y: 11 }], { left: 0, top: 0, fill: color, stroke: "#263241", strokeWidth: 2, strokeDashArray: dashed ? [8, 5] : null, originX: "center", originY: "center", ...commonOptions(name, assetType, left, top) });
        arrow.colorable = true;
        return arrow;
    }

    function createVehicleDirection(left, top) { return createSpecialArrow("Vehicle Direction", "vehicle-direction", "#1d9b61", left, top, true); }
    function createImpactArrow(left, top) { return createSpecialArrow("Impact Arrow", "impact-arrow", "#dc3030", left, top); }

    function createTurnOnlyArrow(direction, left, top) {
        const isLeft = direction === "left";
        const turnPath = new fabric.Path(isLeft
            ? "M 26 68 L 26 -3 Q 26 -40 -14 -40 L -48 -40"
            : "M -26 68 L -26 -3 Q -26 -40 14 -40 L 48 -40", {
            fill: "", stroke: "#2563eb", strokeWidth: 14, strokeLineCap: "round", strokeLineJoin: "round",
            originX: "center", originY: "center"
        });
        turnPath.strokeColorable = true;
        const arrowHead = new fabric.Triangle({
            left: isLeft ? -52 : 52, top: -40, width: 34, height: 34,
            angle: isLeft ? -90 : 90, fill: "#2563eb", stroke: "#163b8f", strokeWidth: 1,
            originX: "center", originY: "center"
        });
        arrowHead.colorable = true;
        return group([
            turnPath,
            arrowHead,
            new fabric.Text("ONLY", { left: isLeft ? 26 : -26, top: 88, fill: "#263241", fontSize: 20, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], isLeft ? "Left Turn Only Arrow" : "Right Turn Only Arrow", isLeft ? "left-only-arrow" : "right-only-arrow", left, top);
    }

    function createStraightTurnArrow(direction, left, top) {
        const isLeft = direction === "left";
        const sign = isLeft ? -1 : 1;
        // A shared stem splits into a straight branch (continuing up) and a
        // curved branch (turning to the side), each with its own arrowhead.
        const pathData = `M 0 70 L 0 -5 M 0 -5 Q 0 -40 ${34 * sign} -40 L ${60 * sign} -40 M 0 -5 L 0 -78`;
        const turnPath = new fabric.Path(pathData, {
            fill: "", stroke: "#2563eb", strokeWidth: 14, strokeLineCap: "round", strokeLineJoin: "round",
            originX: "center", originY: "center"
        });
        turnPath.strokeColorable = true;
        const turnArrowHead = new fabric.Triangle({
            left: 64 * sign, top: -40, width: 34, height: 34,
            angle: isLeft ? -90 : 90, fill: "#2563eb", stroke: "#163b8f", strokeWidth: 1,
            originX: "center", originY: "center"
        });
        turnArrowHead.colorable = true;
        const straightArrowHead = new fabric.Triangle({
            left: 0, top: -82, width: 34, height: 34,
            fill: "#2563eb", stroke: "#163b8f", strokeWidth: 1,
            originX: "center", originY: "center"
        });
        straightArrowHead.colorable = true;
        return group([
            turnPath,
            turnArrowHead,
            straightArrowHead,
            new fabric.Text("ONLY", { left: 0, top: 100, fill: "#263241", fontSize: 20, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], isLeft ? "Straight and Left Turn Arrow" : "Straight and Right Turn Arrow", isLeft ? "straight-left-arrow" : "straight-right-arrow", left, top);
    }

    function createEmergencyVehicle(name, assetType, color, lightColor, left, top) {
        const isAmbulance = assetType === "ambulance";
        const width = isAmbulance ? 92 : 80;
        const length = isAmbulance ? 180 : 152;
        const wheelX = width / 2 + 4;
        const stripeWidth = isAmbulance ? 18 : 20;
        const stripeTop = isAmbulance ? 4 : 12;
        const stripeHeight = length - 36;
        // Police and ambulance share near-identical body/light colors once the
        // Monochrome theme flattens both blue and red to almost the same grey,
        // so they're told apart by pattern (checkered vs solid + cross) rather
        // than color alone: a solid-color stripe is indistinguishable from
        // another solid stripe in grayscale, but a checker pattern still reads
        // as a checker pattern.
        const stripeItems = isAmbulance
            ? [rect({ left: 0, top: stripeTop, width: stripeWidth, height: stripeHeight, fill: lightColor, opacity: .9, originX: "center", originY: "center" })]
            : Array.from({ length: 6 }, (_, index) => {
                const segmentHeight = stripeHeight / 6;
                return rect({
                    left: 0,
                    top: stripeTop - stripeHeight / 2 + segmentHeight * (index + .5),
                    width: stripeWidth, height: segmentHeight,
                    fill: index % 2 === 0 ? lightColor : "#ffffff",
                    stroke: "#94a3b8", strokeWidth: index % 2 === 0 ? 0 : 1,
                    originX: "center", originY: "center"
                });
            });
        const items = [
            rect({ left: -wheelX, top: -45, width: 12, height: 31, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: wheelX, top: -45, width: 12, height: 31, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: -wheelX, top: 45, width: 12, height: 31, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: wheelX, top: 45, width: 12, height: 31, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 0, top: 0, width, height: length, rx: isAmbulance ? 12 : 24, fill: color, stroke: "#263241", strokeWidth: 3, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -length / 2 + 28, width: width - 18, height: 28, rx: 5, fill: "#cbe5f0", stroke: "#334155", strokeWidth: 2, originX: "center", originY: "center" }),
            ...stripeItems,
            rect({ left: -width * .23, top: -18, width: width * .46, height: 12, rx: 3, fill: "#e53935", stroke: "#fff", strokeWidth: 1, originX: "center", originY: "center" }),
            rect({ left: width * .23, top: -18, width: width * .46, height: 12, rx: 3, fill: "#2563eb", stroke: "#fff", strokeWidth: 1, originX: "center", originY: "center" }),
            new fabric.Text(isAmbulance ? "+" : "POLICE", { left: 0, top: 35, fill: isAmbulance ? "#d52d2d" : "#173e75", fontSize: isAmbulance ? 38 : 13, fontWeight: "900", fontFamily: "Arial", angle: 90, originX: "center", originY: "center" })
        ];
        return group(items, `${name} ${objectSequence++}`, assetType, left, top);
    }

    function createPoliceCar(left, top) { return createEmergencyVehicle("Police Car", "police-car", "#f4f6f8", "#2563eb", left, top); }
    function createAmbulance(left, top) { return createEmergencyVehicle("Ambulance", "ambulance", "#f7f7f7", "#dc2626", left, top); }

    function createBus(left, top) {
        const items = [
            rect({ left: -47, top: -60, width: 12, height: 36, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 47, top: -60, width: 12, height: 36, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: -47, top: 60, width: 12, height: 36, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 47, top: 60, width: 12, height: 36, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 0, top: 0, width: 88, height: 210, rx: 12, fill: "#e0a72f", stroke: "#263241", strokeWidth: 3, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -83, width: 70, height: 29, rx: 5, fill: "#bfe0ed", stroke: "#334155", strokeWidth: 2, originX: "center", originY: "center" }),
            ...[-45, -8, 29, 66].map(y => rect({ left: 0, top: y, width: 62, height: 25, rx: 4, fill: "rgba(191,224,237,.72)", stroke: "#9a7622", strokeWidth: 1, originX: "center", originY: "center" })),
            new fabric.Text("BUS", { left: 0, top: 0, fill: "#5a420f", fontSize: 17, fontWeight: "900", fontFamily: "Arial", angle: 90, originX: "center", originY: "center" })
        ];
        return group(items, `Bus ${objectSequence++}`, "bus", left, top);
    }

    function createParatransit(left, top) {
        const items = [
            rect({ left: -48, top: -55, width: 12, height: 34, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 48, top: -55, width: 12, height: 34, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: -48, top: 55, width: 12, height: 34, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 48, top: 55, width: 12, height: 34, rx: 4, fill: "#1f2937", originX: "center", originY: "center" }),
            rect({ left: 0, top: 0, width: 90, height: 195, rx: 16, fill: "#ffffff", stroke: "#263241", strokeWidth: 3, originX: "center", originY: "center" }, true),
            rect({ left: -32, top: 4, width: 15, height: 168, fill: "#1672bd", originX: "center", originY: "center" }),
            rect({ left: 32, top: 4, width: 15, height: 168, fill: "#1672bd", originX: "center", originY: "center" }),
            rect({ left: 0, top: -72, width: 63, height: 30, rx: 5, fill: "#c7e4f0", stroke: "#334155", strokeWidth: 2, originX: "center", originY: "center" }),
            rect({ left: 0, top: 64, width: 48, height: 37, rx: 7, fill: "#e7eef3", stroke: "#7b8b96", strokeWidth: 1, originX: "center", originY: "center" }),
            new fabric.Text("ACCESS-A-RIDE", { left: 0, top: 2, fill: "#155e9d", fontSize: 12, fontWeight: "900", fontFamily: "Arial", angle: 90, originX: "center", originY: "center" }),
            new fabric.Text("AAR", { left: 0, top: 61, fill: "#155e9d", fontSize: 16, fontWeight: "900", fontFamily: "Arial", originX: "center", originY: "center" })
        ];
        return group(items, `NYC Access-A-Ride ${objectSequence++}`, "paratransit", left, top);
    }

    function createBicycle(left, top) {
        const frame = new fabric.Polygon([{ x: 0, y: -28 }, { x: -21, y: 20 }, { x: 21, y: 20 }], { fill: "transparent", stroke: "#2563eb", strokeWidth: 6, strokeLineJoin: "round", originX: "center", originY: "center" });
        const frontFork = line([0, -28, 0, -58], { stroke: "#2563eb", strokeWidth: 6 });
        const rearFork = line([-21, 20, 0, 58], { stroke: "#2563eb", strokeWidth: 6 });
        frame.strokeColorable = true;
        frontFork.strokeColorable = true;
        rearFork.strokeColorable = true;
        return group([
            new fabric.Ellipse({ left: 0, top: -57, rx: 11, ry: 27, fill: "transparent", stroke: "#263241", strokeWidth: 6, originX: "center", originY: "center" }),
            new fabric.Ellipse({ left: 0, top: 57, rx: 11, ry: 27, fill: "transparent", stroke: "#263241", strokeWidth: 6, originX: "center", originY: "center" }),
            frame,
            frontFork,
            rearFork,
            circle({ left: 0, top: 8, radius: 8, fill: "#fff", stroke: "#2563eb", strokeWidth: 5, originX: "center", originY: "center" }),
            line([-28, -31, 28, -31], { stroke: "#263241", strokeWidth: 6 }),
            rect({ left: 0, top: 29, width: 30, height: 9, rx: 4, fill: "#263241", originX: "center", originY: "center" }),
            line([-18, 7, 18, 7], { stroke: "#263241", strokeWidth: 4 })
        ], `Bicycle ${objectSequence++}`, "bicycle", left, top, { selectedColor: "#2563eb" });
    }

    function createUtilityPole(left, top) {
        return group([
            rect({ left: 0, top: 0, width: 14, height: 180, fill: "#765238", stroke: "#493222", strokeWidth: 2, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -62, width: 130, height: 10, fill: "#765238", stroke: "#493222", strokeWidth: 2, originX: "center", originY: "center" }, true),
            circle({ left: -48, top: -52, radius: 7, fill: "#d9e0e6", stroke: "#49515a", strokeWidth: 2, originX: "center", originY: "center" }),
            circle({ left: 48, top: -52, radius: 7, fill: "#d9e0e6", stroke: "#49515a", strokeWidth: 2, originX: "center", originY: "center" })
        ], "Utility Pole", "utility-pole", left, top);
    }

    function createFireHydrant(left, top) {
        return group([
            rect({ left: 0, top: 12, width: 58, height: 85, rx: 12, fill: "#d83b34", stroke: "#76231f", strokeWidth: 3, originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -35, width: 78, height: 13, rx: 5, fill: "#d83b34", stroke: "#76231f", strokeWidth: 3, originX: "center", originY: "center" }, true),
            new fabric.Triangle({ left: 0, top: -53, width: 62, height: 31, fill: "#d83b34", stroke: "#76231f", strokeWidth: 3, originX: "center", originY: "center" }),
            circle({ left: -37, top: 3, radius: 15, fill: "#d83b34", stroke: "#76231f", strokeWidth: 4, originX: "center", originY: "center" }),
            circle({ left: 37, top: 3, radius: 15, fill: "#d83b34", stroke: "#76231f", strokeWidth: 4, originX: "center", originY: "center" }),
            rect({ left: 0, top: 59, width: 82, height: 12, rx: 4, fill: "#8e2924", originX: "center", originY: "center" })
        ], "Fire Hydrant", "fire-hydrant", left, top);
    }

    function createStopSign(left, top) {
        const pole = rect({ left: 0, top: 38, width: 8, height: 82, fill: "#7b8794", originX: "center", originY: "center" }, true);
        const sign = new fabric.Polygon([{ x: -32, y: -14 }, { x: -14, y: -32 }, { x: 14, y: -32 }, { x: 32, y: -14 }, { x: 32, y: 14 }, { x: 14, y: 32 }, { x: -14, y: 32 }, { x: -32, y: 14 }], { left: 0, top: -30, fill: "#cf3030", stroke: "#ffffff", strokeWidth: 4, originX: "center", originY: "center" });
        sign.colorable = true;
        const text = new fabric.Text("STOP", { left: 0, top: -30, fill: "#fff", fontSize: 18, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" });
        return group([pole, sign, text], "Stop sign", "stop-sign", left, top);
    }

    function createTrafficLight(left, top) {
        return group([
            rect({ left: 0, top: 25, width: 8, height: 95, fill: "#647180", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -37, width: 43, height: 105, rx: 8, fill: "#252b31", stroke: "#111827", strokeWidth: 2, originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -69, radius: 11, fill: "#e83c3c", originX: "center", originY: "center" }),
            circle({ left: 0, top: -37, radius: 11, fill: "#f0b429", originX: "center", originY: "center" }),
            circle({ left: 0, top: -5, radius: 11, fill: "#32a852", originX: "center", originY: "center" })
        ], "Traffic light", "traffic-light", left, top);
    }

    function createYieldSign(left, top) {
        const triangle = new fabric.Triangle({ left: 0, top: -20, width: 72, height: 68, angle: 180, fill: "#fff", stroke: "#d13636", strokeWidth: 6, originX: "center", originY: "center" });
        triangle.colorable = true;
        return group([
            rect({ left: 0, top: 40, width: 8, height: 85, fill: "#788491", originX: "center", originY: "center" }, true),
            triangle,
            new fabric.Text("YIELD", { left: 0, top: -20, fill: "#b91c1c", fontSize: 13, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "Yield sign", "yield-sign", left, top);
    }

    function createSpeedSign(left, top) {
        const speedText = new fabric.Text("SPEED\nLIMIT\n35", { left: 0, top: -25, fill: "#111", fontSize: 14, lineHeight: .88, textAlign: "center", fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" });
        speedText.editableTextRole = "speed-limit";
        return group([
            rect({ left: 0, top: 42, width: 8, height: 84, fill: "#778390", originX: "center", originY: "center" }, true),
            rect({ left: 0, top: -25, width: 62, height: 78, rx: 4, fill: "#fff", stroke: "#202a34", strokeWidth: 3, originX: "center", originY: "center" }, true),
            speedText
        ], "Speed limit sign", "speed-sign", left, top);
    }

    function createTree(left, top) {
        return group([
            rect({ left: 0, top: 32, width: 20, height: 70, fill: "#82552f", rx: 3, originX: "center", originY: "center" }, true),
            circle({ left: -24, top: -15, radius: 33, fill: "#30935f", stroke: "#176a41", strokeWidth: 2, originX: "center", originY: "center" }, true),
            circle({ left: 22, top: -14, radius: 36, fill: "#3eaa6e", stroke: "#176a41", strokeWidth: 2, originX: "center", originY: "center" }, true),
            circle({ left: 0, top: -42, radius: 35, fill: "#4db878", stroke: "#176a41", strokeWidth: 2, originX: "center", originY: "center" }, true)
        ], "Tree", "tree", left, top);
    }

    function createBuilding(left, top) {
        const items = [rect({ left: 0, top: 0, width: 155, height: 150, fill: "#d7dce2", stroke: "#66717e", strokeWidth: 3, originX: "center", originY: "center" }, true)];
        for (let y = -47; y <= 25; y += 36) for (let x = -48; x <= 48; x += 48) items.push(rect({ left: x, top: y, width: 25, height: 23, fill: "#7fc0dd", stroke: "#4b7183", strokeWidth: 1, originX: "center", originY: "center" }));
        items.push(rect({ left: 0, top: 56, width: 30, height: 38, fill: "#6b4e3d", originX: "center", originY: "center" }));
        return group(items, "Building", "building", left, top);
    }

    function createHouse(left, top) {
        // A clean symmetric gable (a plain triangle) reads as a proper roof at
        // any scale; the previous jagged multi-point outline self-intersected
        // and looked like a hand-drawn zigzag rather than an actual roofline.
        const wallWidth = 170, wallHeight = 118, wallCenterY = 32;
        const roofBaseY = wallCenterY - wallHeight / 2;
        const roofHalfWidth = wallWidth / 2 + 16;
        const roofPeakY = roofBaseY - 66;

        const roof = new fabric.Polygon([
            { x: -roofHalfWidth, y: roofBaseY }, { x: 0, y: roofPeakY }, { x: roofHalfWidth, y: roofBaseY }
        ], { fill: "#a4402f", stroke: "#5c2418", strokeWidth: 3, strokeLineJoin: "round", originX: "center", originY: "center" });

        const chimney = rect({ left: 58, top: -58, width: 22, height: 56, fill: "#8a5a45", stroke: "#54372a", strokeWidth: 2, originX: "center", originY: "center" });
        const chimneyCap = rect({ left: 58, top: -87, width: 28, height: 8, rx: 1, fill: "#4b3327", originX: "center", originY: "center" });
        const ridgeLine = line([0, roofPeakY + 5, 0, roofBaseY - 1], { stroke: "#7a2e20", strokeWidth: 2 });
        const eaveTrim = rect({ left: 0, top: roofBaseY + 3, width: roofHalfWidth * 2 - 6, height: 7, rx: 2, fill: "#f5f1e6", stroke: "#c9c2b0", strokeWidth: 1, originX: "center", originY: "center" });

        const houseWindow = (x) => {
            const sign = x < 0 ? -1 : 1;
            return [
                rect({ left: x, top: 18, width: 36, height: 36, rx: 2, fill: "#a9d9ec", stroke: "#3f5b6b", strokeWidth: 2, originX: "center", originY: "center" }),
                line([x, 1, x, 35], { stroke: "#ffffff", strokeWidth: 2 }),
                line([x - 17, 18, x + 17, 18], { stroke: "#ffffff", strokeWidth: 2 }),
                rect({ left: x, top: 39, width: 42, height: 6, rx: 2, fill: "#eef1f4", stroke: "#8b93a0", strokeWidth: 1, originX: "center", originY: "center" }),
                rect({ left: x + 27 * sign, top: 18, width: 8, height: 38, rx: 1, fill: "#3f6b52", stroke: "#274734", strokeWidth: 1, originX: "center", originY: "center" })
            ];
        };

        return group([
            rect({ left: 0, top: wallCenterY, width: wallWidth, height: wallHeight, rx: 3, fill: "#f2e4c8", stroke: "#5c6b7d", strokeWidth: 3, originX: "center", originY: "center" }, true),
            ...houseWindow(-52),
            ...houseWindow(52),
            rect({ left: 0, top: 63, width: 30, height: 54, rx: 3, fill: "#33404f", stroke: "#1c242e", strokeWidth: 2, originX: "center", originY: "center" }),
            rect({ left: 0, top: 58, width: 20, height: 20, rx: 1, fill: "transparent", stroke: "#1c242e", strokeWidth: 1.5, originX: "center", originY: "center" }),
            circle({ left: 11, top: 68, radius: 2.5, fill: "#f2cf63", stroke: "#6e5422", strokeWidth: 1, originX: "center", originY: "center" }),
            rect({ left: 0, top: 91, width: wallWidth + 4, height: 8, fill: "#9aa1ab", stroke: "#656d78", strokeWidth: 1, originX: "center", originY: "center" }),
            chimney,
            roof,
            eaveTrim,
            ridgeLine,
            chimneyCap
        ], "House", "house", left, top);
    }

    function createHouseDriveway(left, top) {
        return group([
            rect({ left: 0, top: 0, width: 118, height: 230, rx: 3, fill: "#b8bec5", stroke: "#69727c", strokeWidth: 3, originX: "center", originY: "center" }, true),
            line([-43, -112, -43, 112], { stroke: "#e3e6e9", strokeWidth: 3 }),
            line([43, -112, 43, 112], { stroke: "#e3e6e9", strokeWidth: 3 }),
            line([-58, -106, 58, -106], { stroke: "#565f69", strokeWidth: 5 }),
            line([-22, -85, -22, 95], { stroke: "rgba(91,99,108,.22)", strokeWidth: 5 }),
            line([22, -85, 22, 95], { stroke: "rgba(91,99,108,.22)", strokeWidth: 5 })
        ], "House Driveway", "house-driveway", left, top, { lockUniScaling: true });
    }

    function createPedestrian(left, top) {
        return group([
            circle({ left: 0, top: -45, radius: 14, fill: "#f0bd91", stroke: "#354052", strokeWidth: 2, originX: "center", originY: "center" }, true),
            line([0, -28, 0, 22], { stroke: "#2458d3", strokeWidth: 11 }),
            line([0, -12, -28, 10], { stroke: "#354052", strokeWidth: 7 }),
            line([0, -12, 28, 10], { stroke: "#354052", strokeWidth: 7 }),
            line([0, 20, -22, 58], { stroke: "#354052", strokeWidth: 8 }),
            line([0, 20, 25, 58], { stroke: "#354052", strokeWidth: 8 })
        ], "Pedestrian", "pedestrian", left, top);
    }

    function createNorthCompass(left, top) {
        const northPointer = new fabric.Triangle({
            left: 0, top: -22, width: 22, height: 48, fill: "#dc3030",
            stroke: "#991b1b", strokeWidth: 1.5, originX: "center", originY: "center"
        });
        northPointer.colorable = true;
        const southPointer = new fabric.Triangle({
            left: 0, top: 22, width: 22, height: 48, angle: 180, fill: "#526071",
            stroke: "#273444", strokeWidth: 1.5, originX: "center", originY: "center"
        });
        return group([
            circle({ left: 0, top: 0, radius: 50, fill: "rgba(255,255,255,.92)", stroke: "#273444", strokeWidth: 2, originX: "center", originY: "center" }),
            line([-42, 0, 42, 0], { stroke: "#a6afba", strokeWidth: 1 }),
            line([0, -42, 0, 42], { stroke: "#a6afba", strokeWidth: 1 }),
            northPointer,
            southPointer,
            circle({ left: 0, top: 0, radius: 5, fill: "#ffffff", stroke: "#273444", strokeWidth: 2, originX: "center", originY: "center" }),
            new fabric.Text("N", { left: 0, top: -68, fill: "#b91c1c", fontSize: 20, fontWeight: "800", fontFamily: "Arial", originX: "center", originY: "center" }),
            new fabric.Text("E", { left: 66, top: 0, fill: "#526071", fontSize: 14, fontWeight: "700", fontFamily: "Arial", originX: "center", originY: "center" }),
            new fabric.Text("S", { left: 0, top: 66, fill: "#526071", fontSize: 14, fontWeight: "700", fontFamily: "Arial", originX: "center", originY: "center" }),
            new fabric.Text("W", { left: -67, top: 0, fill: "#526071", fontSize: 14, fontWeight: "700", fontFamily: "Arial", originX: "center", originY: "center" })
        ], "North Compass", "north-compass", left, top);
    }

    function createMeasurementLine(left, top, length = 220, angle = 0, label = "Enter distance") {
        const safeLength = Math.max(60, Number(length) || 220);
        const half = safeLength / 2;
        const strokeOptions = { stroke: "#1f2937", strokeWidth: 3, strokeLineCap: "round" };
        const measurementText = new fabric.Text(label, {
            left: 0, top: -19, fill: "#111827", backgroundColor: "rgba(255,255,255,.92)",
            fontSize: 17, fontWeight: "700", fontFamily: "Arial", originX: "center", originY: "center"
        });
        measurementText.editableTextRole = "measurement-label";
        measurementText.colorable = true;
        const measurementLines = [
            line([-half, 0, half, 0], strokeOptions),
            line([-half, -10, -half, 10], strokeOptions),
            line([half, -10, half, 10], strokeOptions),
            line([-half, 0, -half + 13, -7], strokeOptions),
            line([-half, 0, -half + 13, 7], strokeOptions),
            line([half, 0, half - 13, -7], strokeOptions),
            line([half, 0, half - 13, 7], strokeOptions)
        ];
        measurementLines.forEach(item => { item.strokeColorable = true; });
        const measurement = group([...measurementLines, measurementText], `Distance Measurement ${objectSequence++}`, "measurement-line", left, top);
        measurement.measurementLabel = label;
        measurement.rotate(angle);
        return measurement;
    }

    function createMeasurementLineBetween(start, end) {
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
        return createMeasurementLine((start.x + end.x) / 2, (start.y + end.y) / 2, length, angle);
    }

    function createCalloutArrow(left, top, angle = 0) {
        const half = 85;
        // The shaft runs all the way to the tip point; an open "V" chevron
        // (two strokes, not a filled triangle) sits right at that same point.
        const shaft = line([-half, 0, half, 0], { stroke: "#111111", strokeWidth: 1.5, strokeLineCap: "round" });
        shaft.strokeColorable = true;
        const chevronTop = line([-half, 0, -half + 14, -8], { stroke: "#111111", strokeWidth: 2, strokeLineCap: "round" });
        chevronTop.strokeColorable = true;
        const chevronBottom = line([-half, 0, -half + 14, 8], { stroke: "#111111", strokeWidth: 2, strokeLineCap: "round" });
        chevronBottom.strokeColorable = true;
        const callout = group([shaft, chevronTop, chevronBottom], "Pointer Arrow", "callout-arrow", left, top);
        callout.rotate(angle);
        return callout;
    }

    function createArrow(left, top) {
        const arrow = new fabric.Polygon([{ x: -75, y: -14 }, { x: 25, y: -14 }, { x: 25, y: -34 }, { x: 78, y: 0 }, { x: 25, y: 34 }, { x: 25, y: 14 }, { x: -75, y: 14 }], { left: 0, top: 0, fill: "#2458d3", stroke: "#163b8f", strokeWidth: 2, originX: "center", originY: "center" });
        arrow.colorable = true;
        arrow.set(commonOptions("Direction arrow", "arrow", left, top));
        return arrow;
    }

    function createText(left, top) {
        return new fabric.IText("Type label", { ...commonOptions("Text label", "text", left, top), fill: "#111827", fontFamily: "Arial", fontSize: 28, fontWeight: "700", fontStyle: "normal" });
    }

    function createAsset(assetType, left = CANVAS_WIDTH / 2, top = CANVAS_HEIGHT / 2) {
        switch (assetType) {
            case "road-horizontal": return createRoad(true, left, top);
            case "road-vertical": return createRoad(false, left, top);
            case "l-road": return createLRoad(left, top);
            case "intersection": return createIntersection(left, top);
            case "t-junction": return createTJunction(left, top);
            case "crosswalk": return createCrosswalk(left, top);
            case "four-way-crosswalk": return createFourWayCrosswalk(left, top);
            case "stop-line": return createStopLine(left, top);
            case "sidewalk": return createSidewalk(left, top);
            case "driveway": return createDriveway(left, top);
            case "solid-line": return createRoadLine(false, left, top);
            case "dashed-line": return createRoadLine(true, left, top);
            case "turn-lane": return createTurnLane(left, top);
            case "car": return createCar("Car", "car", "#2e67d1", left, top);
            case "truck": return createCar("Truck", "truck", "#27845f", left, top, 1.08);
            case "motorcycle": return createMotorcycle(left, top);
            case "bus": return createBus(left, top);
            case "paratransit": return createParatransit(left, top);
            case "bicycle": return createBicycle(left, top);
            case "police-car": return createPoliceCar(left, top);
            case "ambulance": return createAmbulance(left, top);
            case "stop-sign": return createStopSign(left, top);
            case "traffic-light": return createTrafficLight(left, top);
            case "yield-sign": return createYieldSign(left, top);
            case "speed-sign": return createSpeedSign(left, top);
            case "do-not-enter": return createDoNotEnter(left, top);
            case "no-parking": return createNoParking(left, top);
            case "no-turn": return createNoTurn(left, top);
            case "one-way": return createOneWay(left, top);
            case "curve-warning": return createCurveWarning(left, top);
            case "intersection-warning": return createIntersectionWarning(left, top);
            case "merge-warning": return createMergeWarning(left, top);
            case "lane-ends": return createLaneEndsWarning(left, top);
            case "slippery-road": return createSlipperyWarning(left, top);
            case "pedestrian-crossing": return createPedestrianCrossing(left, top);
            case "school-crossing": return createSchoolCrossing(left, top);
            case "construction-sign": return createConstructionSign(left, top);
            case "railroad-crossing": return createRailroadCrossing(left, top);
            case "street-name": return createStreetName(left, top);
            case "route-marker": return createRouteMarker(left, top);
            case "exit-sign": return createExitSign(left, top);
            case "detour-sign": return createDetourSign(left, top);
            case "left-only-arrow": return createTurnOnlyArrow("left", left, top);
            case "right-only-arrow": return createTurnOnlyArrow("right", left, top);
            case "straight-left-arrow": return createStraightTurnArrow("left", left, top);
            case "straight-right-arrow": return createStraightTurnArrow("right", left, top);
            case "traffic-cone": return createTrafficCone(left, top);
            case "barricade": return createBarricade(left, top);
            case "guardrail": return createGuardrail(left, top);
            case "flashing-light": return createFlashingLight(left, top);
            case "collision-point": return createCollisionPoint(left, top);
            case "debris": return createDebris(left, top);
            case "skid-marks": return createSkidMarks(left, top);
            case "vehicle-direction": return createVehicleDirection(left, top);
            case "impact-arrow": return createImpactArrow(left, top);
            case "tree": return createTree(left, top);
            case "building": return createBuilding(left, top);
            case "house": return createHouse(left, top);
            case "house-driveway": return createHouseDriveway(left, top);
            case "pedestrian": return createPedestrian(left, top);
            case "utility-pole": return createUtilityPole(left, top);
            case "fire-hydrant": return createFireHydrant(left, top);
            case "north-compass": return createNorthCompass(left, top);
            case "measurement-line": return createMeasurementLine(left, top);
            case "callout-arrow": return createCalloutArrow(left, top);
            case "arrow": return createArrow(left, top);
            case "text": return createText(left, top);
            default: return null;
        }
    }

    function createTemplateObject(specification) {
        const object = createAsset(specification.assetType, specification.left, specification.top);
        if (!object) throw new Error(`Unknown template asset: ${specification.assetType}`);
        configureSmartRoad(object);

        if (specification.scale != null) object.scale(specification.scale);
        if (specification.scaleX != null) object.scaleX = specification.scaleX;
        if (specification.scaleY != null) object.scaleY = specification.scaleY;
        if (specification.angle != null) object.rotate(specification.angle);
        if (specification.color) {
            object.selectedColor = specification.color;
            forEachColorable(object, item => item.set(item.strokeColorable ? "stroke" : "fill", specification.color));
        }

        if (isVehicle(object)) {
            ensureVehicleMetadata(object);
            if (specification.direction) {
                object.directionOfTravel = specification.direction;
                const direction = VEHICLE_DIRECTIONS[specification.direction];
                if (direction?.angle != null) object.rotate(direction.angle);
            }
        }

        applySceneThemeToObject(object);
        canvas.add(object);
        object.setCoords();
        const snappedToEndpoint = snapRoadToNearbyEndpoint(object);
        const snappedRoadName = object._roadEndpointSnapNotice;
        delete object._roadEndpointSnapNotice;
        if (isVehicle(object)) ensureVehicleUnitLabel(object);
        return object;
    }

    async function applyCrashTemplate(templateId) {
        const template = CRASH_TEMPLATES[templateId];
        if (!template) return;
        if (mapNavigationActive && !(await finishMapNavigation())) return;

        const hasSceneObjects = canvas.getObjects().some(object => !object.isVehicleUnitLabel);
        if (hasSceneObjects && !window.confirm("Applying this template will replace the current diagram objects. Report information and the selected map background will remain. Continue?")) return;

        templateModalInstance?.hide();
        setInteractionMode("select");
        canvas.discardActiveObject();
        historyLocked = true;
        try {
            canvas.getObjects().slice().forEach(object => canvas.remove(object));
            objectSequence = 1;
            vehicleIdSequence = 1;
            template.objects.forEach(createTemplateObject);
            enforceAutomaticRoadLayering();
        } finally {
            historyLocked = false;
        }

        canvas.requestRenderAll();
        updatePropertiesPanel();
        resetHistory();
        showToast(`${template.name} template added`);
    }

    function addAsset(assetType, left, top) {
        const object = createAsset(assetType, left, top);
        if (!object) return;
        historyLocked = true;
        configureSmartRoad(object);
        if (isVehicle(object)) {
            object.directionOfTravel = "north";
            object.rotate(VEHICLE_DIRECTIONS.north.angle);
            ensureVehicleMetadata(object);
        }
        applySceneThemeToObject(object);
        canvas.add(object);
        object.setCoords();
        const snappedToEndpoint = snapRoadToNearbyEndpoint(object);
        const snappedRoadName = object._roadEndpointSnapNotice;
        delete object._roadEndpointSnapNotice;
        if (isVehicle(object)) ensureVehicleUnitLabel(object);
        enforceAutomaticRoadLayering();
        historyLocked = false;
        canvas.setActiveObject(object);
        canvas.requestRenderAll();
        updatePropertiesPanel();
        if (object.type === "i-text") {
            object.enterEditing();
            object.selectAll();
        }
        saveHistory();
        if (snappedToEndpoint) showToast(`Road connected to ${snappedRoadName}`);
        else if (isBaseRoad(object)) showToast("Road automatically placed behind the scene objects");
        else if (isRoadMarking(object)) showToast("Road marking placed above roads and behind the scene objects");
        else if (object.assetType === "measurement-line") showToast("Measurement added — resize or rotate it, then enter the actual distance in Properties");
        else if (object.assetType === "north-compass") showToast("North compass added — rotate it to match the scene orientation");
        else if (object.assetType === "callout-arrow") showToast("Pointer arrow added — rotate it to point at the detail");
    }

    function activeObject() { return canvas.getActiveObject(); }

    async function selectAllObjects() {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode("select");
        const objects = canvas.getObjects().filter(object => !object.isVehicleUnitLabel && object.selectable !== false && !object.locked);
        if (!objects.length) {
            showToast("There are no diagram objects to select");
            return;
        }

        canvas.discardActiveObject();
        if (objects.length === 1) {
            canvas.setActiveObject(objects[0]);
        } else {
            const selection = new fabric.ActiveSelection(objects, { canvas });
            canvas.setActiveObject(selection);
            selection.setCoords();
        }
        canvas.requestRenderAll();
        updatePropertiesPanel();
        const lockedCount = canvas.getObjects().filter(object => !object.isVehicleUnitLabel && object.locked).length;
        showToast(`${objects.length} objects selected${lockedCount ? ` (${lockedCount} locked object${lockedCount === 1 ? "" : "s"} excluded)` : ""} — drag to move or rotate`);
    }

    function deleteSelected() {
        const active = activeObject();
        if (!active) return;
        if (isLocked(active)) {
            showToast("Unlock this object before deleting it");
            return;
        }
        historyLocked = true;
        if (active.type === "activeSelection") active.getObjects().forEach(object => { removeVehicleUnitLabel(object); canvas.remove(object); });
        else { removeVehicleUnitLabel(active); canvas.remove(active); }
        historyLocked = false;
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
    }

    function duplicateSelected() {
        const active = activeObject();
        if (!active) return;
        active.clone(clone => {
            clone.set({ left: active.left + 25, top: active.top + 25, evented: true, displayName: `${active.displayName || "Object"} copy` });
            historyLocked = true;
            if (clone.type === "activeSelection") {
                clone.canvas = canvas;
                clone.forEachObject(object => {
                    configureSmartRoad(object);
                    setObjectLocked(object, false);
                    if (isVehicle(object)) ensureVehicleMetadata(object, true);
                    canvas.add(object);
                    object.setCoords();
                    if (isVehicle(object)) ensureVehicleUnitLabel(object);
                });
                clone.setCoords();
            } else {
                configureSmartRoad(clone);
                setObjectLocked(clone, false);
                if (isVehicle(clone)) ensureVehicleMetadata(clone, true);
                canvas.add(clone);
                clone.setCoords();
                if (isVehicle(clone)) ensureVehicleUnitLabel(clone);
            }
            enforceAutomaticRoadLayering();
            historyLocked = false;
            canvas.setActiveObject(clone);
            canvas.requestRenderAll();
            updatePropertiesPanel();
            saveHistory();
            if (isBaseRoad(clone)) showToast("Duplicated road kept behind the scene objects");
        }, SERIALIZED_PROPERTIES);
    }

    function forEachColorable(object, callback) {
        if (object.colorable || object.strokeColorable || object.type === "i-text" || object.assetType === "arrow") callback(object);
        if (object.getObjects) object.getObjects().forEach(child => forEachColorable(child, callback));
    }

    function rgbToHex(color) {
        if (!color || color === "transparent") return "#2563eb";
        if (color.startsWith("#")) return color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` : color.slice(0, 7);
        const values = color.match(/\d+/g);
        return values?.length >= 3 ? `#${values.slice(0, 3).map(value => Number(value).toString(16).padStart(2, "0")).join("")}` : "#2563eb";
    }

    function primaryFill(object) {
        if (object.selectedColor) return rgbToHex(object.selectedColor);

        let fill = null;
        forEachColorable(object, item => {
            const color = item.strokeColorable ? item.stroke : item.fill;
            if (!fill && color && color !== "transparent") fill = color;
        });

        return rgbToHex(fill || object.fill);
    }

    function findStreetNameText(object) {
        if (!object || object.assetType !== "street-name" || !object.getObjects) return null;
        return object.getObjects().find(item => item.editableTextRole === "street-name")
            || object.getObjects().find(item => item.type === "text");
    }

    function findSpeedLimitText(object) {
        if (!object || object.assetType !== "speed-sign" || !object.getObjects) return null;
        return object.getObjects().find(item => item.editableTextRole === "speed-limit")
            || object.getObjects().find(item => item.type === "text" && String(item.text).includes("SPEED"));
    }

    function findMeasurementText(object) {
        if (!object || object.assetType !== "measurement-line" || !object.getObjects) return null;
        return object.getObjects().find(item => item.editableTextRole === "measurement-label")
            || object.getObjects().find(item => item.type === "text");
    }

    function streetNameFontSize(value) {
        if (value.length <= 10) return 19;
        if (value.length <= 16) return 15;
        return 12;
    }

    function updateEmbeddedLabel(groupObject, textObject, value, maxWidth) {
        textObject.set({ text: value, scaleX: 1 });
        textObject.initDimensions?.();
        if (Number(textObject.width) > maxWidth) textObject.scaleX = maxWidth / textObject.width;
        groupObject.dirty = true;
        groupObject.setCoords();
        canvas.requestRenderAll();
    }

    function updatePropertiesPanel() {
        const active = activeObject();
        const hasSingleSelection = active && active.type !== "activeSelection";
        const streetText = hasSingleSelection ? findStreetNameText(active) : null;
        const speedText = hasSingleSelection ? findSpeedLimitText(active) : null;
        const measurementText = hasSingleSelection ? findMeasurementText(active) : null;
        const textObject = hasSingleSelection && active.type === "i-text" ? active : null;
        const vehicle = hasSingleSelection && isVehicle(active) ? active : null;
        const road = hasSingleSelection && isBaseRoad(active) ? active : null;
        elements.emptyProperties.classList.toggle("d-none", !!hasSingleSelection);
        elements.objectProperties.classList.toggle("d-none", !hasSingleSelection);
        elements.streetNameGroup.classList.toggle("d-none", !streetText);
        elements.speedLimitGroup.classList.toggle("d-none", !speedText);
        elements.textPropertiesGroup.classList.toggle("d-none", !textObject);
        elements.measurementPropertiesGroup.classList.toggle("d-none", !measurementText);
        elements.vehiclePropertiesGroup.classList.toggle("d-none", !vehicle);
        elements.roadPropertiesGroup.classList.toggle("d-none", !road);
        elements.selectedObjectName.textContent = hasSingleSelection ? (active.displayName || "Selected object") : "No object selected";
        if (!hasSingleSelection) return;
        elements.objectLabel.value = active.displayName || "";
        elements.objectLockedToggle.checked = isLocked(active);
        if (streetText) elements.streetNameText.value = streetText.text || "";
        if (speedText) elements.speedLimitValue.value = String(speedText.text).match(/\d+/g)?.at(-1) || "35";
        if (measurementText) elements.measurementLabelText.value = active.measurementLabel || measurementText.text || "";
        if (textObject) {
            const isBold = parseInt(textObject.fontWeight, 10) >= 700 || textObject.fontWeight === "bold";
            const isItalic = textObject.fontStyle === "italic";
            elements.textFontFamily.value = textObject.fontFamily || "Arial";
            elements.textFontSize.value = Math.round(textObject.fontSize || 28);
            elements.textBoldBtn.classList.toggle("btn-secondary", isBold);
            elements.textBoldBtn.classList.toggle("btn-outline-secondary", !isBold);
            elements.textBoldBtn.setAttribute("aria-pressed", String(isBold));
            elements.textItalicBtn.classList.toggle("btn-secondary", isItalic);
            elements.textItalicBtn.classList.toggle("btn-outline-secondary", !isItalic);
            elements.textItalicBtn.setAttribute("aria-pressed", String(isItalic));
        }
        if (vehicle) {
            ensureVehicleMetadata(vehicle);
            elements.vehicleUnitNumber.value = String(vehicle.vehicleUnitNumber);
            elements.vehicleDirection.value = vehicle.directionOfTravel || "";
        }
        if (road) {
            configureSmartRoad(road);
            elements.roadLockHelp.textContent = road.locked
                ? "This road cannot be moved, resized or rotated until it is unlocked."
                : isSnappableRoad(road)
                    ? "Drag an open endpoint near another compatible road. Mouse rotation snaps near 45° increments; typed angles stay exact."
                    : "Mouse rotation snaps near 45° increments; typed angles stay exact. This road can also be locked in place.";
        }
        const activeIsLocked = isLocked(active);
        elements.angleInput.disabled = activeIsLocked;
        elements.rotateLeftBtn.disabled = activeIsLocked;
        elements.rotateRightBtn.disabled = activeIsLocked;
        elements.fillColor.value = primaryFill(active);
        elements.opacityRange.value = Math.round((active.opacity ?? 1) * 100);
        elements.opacityValue.textContent = `${elements.opacityRange.value}%`;
        elements.angleInput.value = Math.round(active.angle || 0);
    }

    function rotateActive(delta) {
        const active = activeObject();
        if (!active) return;
        if (isLocked(active)) {
            showToast("Unlock this object before rotating it");
            return;
        }
        active.rotate((active.angle || 0) + delta);
        active.setCoords();
        if (isVehicle(active)) {
            active.directionOfTravel = directionFromAngle(active.angle);
            syncVehicleUnitLabel(active);
        }
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
        if (isBaseRoad(active)) showToast(`Road rotated to ${Math.round(normalizeAngle(active.angle))}°`);
    }

    function cancelPreviewLine() {
        if (!previewLine) return;
        historyLocked = true;
        canvas.remove(previewLine);
        historyLocked = false;
        previewLine = null;
        lineStart = null;
        lineEnd = null;
        canvas.requestRenderAll();
    }

    function setInteractionMode(mode) {
        if (mode !== interactionMode && previewLine) cancelPreviewLine();
        interactionMode = mode;
        canvas.isDrawingMode = mode === "freehand";
        canvas.selection = mode === "select";
        canvas.skipTargetFind = mode !== "select";
        canvas.freeDrawingBrush.width = 4;
        canvas.freeDrawingBrush.color = sceneTheme === "monochrome" ? "#343a40" : "#d22f2f";
        elements.selectBtn.classList.toggle("active", mode === "select");
        elements.drawBtn.classList.toggle("active", mode === "freehand");
        elements.lineBtn.classList.toggle("active", mode === "line");
        elements.measureBtn.classList.toggle("active", mode === "measure");
        elements.canvasViewport.style.cursor = mode === "select" ? "default" : "crosshair";
        if (mode !== "select") {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            updatePropertiesPanel();
        }
    }

    function setZoom(nextZoom) {
        zoom = Math.min(1.5, Math.max(.45, nextZoom));
        const container = elements.canvasStage.querySelector(".canvas-container");
        if (container) {
            container.style.transformOrigin = "top left";
            container.style.transform = `scale(${zoom})`;
        }
        elements.canvasStage.style.width = `${CANVAS_WIDTH * zoom}px`;
        elements.canvasStage.style.height = `${CANVAS_HEIGHT * zoom}px`;
        elements.googleMapCanvas.style.transform = `scale(${zoom})`;
        elements.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("The map image could not be read."));
            reader.readAsDataURL(blob);
        });
    }

    function fabricImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            fabric.Image.fromURL(url, image => {
                if (image) resolve(image);
                else reject(new Error("The map image could not be displayed."));
            });
        });
    }

    function hideAddressSuggestions() {
        currentSuggestions = [];
        elements.mapAddressSuggestions.replaceChildren();
        elements.mapAddressSuggestions.classList.add("d-none");
        elements.mapAddress.setAttribute("aria-expanded", "false");
    }

    function updateMapNavigationButton() {
        const icon = elements.mapNavigationBtn.querySelector("i");
        const label = elements.mapNavigationBtn.querySelector("span");
        icon.className = mapNavigationActive ? "bi bi-check2-circle me-1" : "bi bi-arrows-move me-1";
        label.textContent = mapNavigationActive ? "Lock map & edit" : "Move map";
        elements.mapNavigationBtn.classList.toggle("btn-primary", mapNavigationActive);
        elements.mapNavigationBtn.classList.toggle("btn-outline-primary", !mapNavigationActive);
    }

    function loadGoogleMapsApi() {
        if (window.google?.maps?.importLibrary) return Promise.resolve();
        if (googleMapsPromise) return googleMapsPromise;

        const apiKey = elements.googleMapPanel.dataset.browserApiKey?.trim();
        if (!apiKey) {
            return Promise.reject(new Error("Add GoogleMaps:BrowserApiKey to enable interactive map movement and address suggestions."));
        }

        googleMapsPromise = new Promise((resolve, reject) => {
            const callbackName = "__accidentDiagramGoogleMapsReady";
            const script = document.createElement("script");
            window[callbackName] = () => {
                delete window[callbackName];
                resolve();
            };
            script.async = true;
            script.onerror = () => {
                delete window[callbackName];
                googleMapsPromise = null;
                reject(new Error("Google Maps JavaScript API could not be loaded. Verify the browser API key and enabled APIs."));
            };
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places&v=weekly&callback=${callbackName}`;
            document.head.appendChild(script);
        });
        return googleMapsPromise;
    }

    function syncMapStateFromInteractiveMap() {
        if (!googleMap) return;
        const center = googleMap.getCenter();
        const mapZoom = Math.round(googleMap.getZoom() || 18);
        if (center) {
            mapState.latitude = center.lat();
            mapState.longitude = center.lng();
        }
        mapState.zoom = Math.min(21, Math.max(12, mapZoom));
        if ([...elements.mapZoom.options].some(option => Number(option.value) === mapState.zoom)) {
            elements.mapZoom.value = String(mapState.zoom);
        }
    }

    async function ensureGoogleMap() {
        await loadGoogleMapsApi();
        const [{ Map }, importedPlaces] = await Promise.all([
            google.maps.importLibrary("maps"),
            google.maps.importLibrary("places")
        ]);
        placesLibrary = importedPlaces;
        autocompleteSessionToken ??= new placesLibrary.AutocompleteSessionToken();

        if (!googleMap) {
            const hasSavedCenter = Number.isFinite(mapState.latitude) && Number.isFinite(mapState.longitude);
            googleMap = new Map(elements.googleMapCanvas, {
                center: hasSavedCenter
                    ? { lat: mapState.latitude, lng: mapState.longitude }
                    : { lat: 40.7128, lng: -74.0060 },
                zoom: mapState.zoom || 18,
                minZoom: 12,
                maxZoom: 21,
                mapTypeId: "roadmap",
                styles: MINIMAL_GOOGLE_MAP_STYLES,
                gestureHandling: "greedy",
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                clickableIcons: false,
                keyboardShortcuts: true
            });
            googleMap.addListener("idle", () => {
                syncMapStateFromInteractiveMap();
                if (mapNavigationActive) setMapStatus("Move or zoom the map, then select Lock map & edit.");
            });
        }

        return googleMap;
    }

    function leaveMapNavigationWithoutSnapshot() {
        mapNavigationActive = false;
        elements.canvasStage.classList.remove("map-navigation-active");
        updateMapNavigationButton();
    }

    async function startMapNavigation() {
        if (mapNavigationActive) return true;
        mapState.enabled = true;
        preservedMapBackground = canvas.backgroundImage || preservedMapBackground;
        mapNavigationActive = true;
        elements.canvasStage.classList.add("map-navigation-active");
        updateMapNavigationButton();
        canvas.backgroundImage = null;
        canvas.backgroundColor = "rgba(255,255,255,0)";
        canvas.requestRenderAll();
        setMapStatus("Loading the interactive map…");

        try {
            await ensureGoogleMap();
            if (Number.isFinite(mapState.latitude) && Number.isFinite(mapState.longitude)) {
                googleMap.setCenter({ lat: mapState.latitude, lng: mapState.longitude });
                googleMap.setZoom(mapState.zoom || 18);
            }
            google.maps.event.trigger(googleMap, "resize");
            setMapStatus("Move or zoom the map, then select Lock map & edit.");
            return true;
        } catch (error) {
            leaveMapNavigationWithoutSnapshot();
            canvas.backgroundImage = preservedMapBackground;
            canvas.backgroundColor = "#ffffff";
            canvas.requestRenderAll();
            setMapStatus(error.message || "The interactive map could not be loaded.", "error");
            return false;
        }
    }

    async function requestStaticMapSnapshot() {
        syncMapStateFromInteractiveMap();
        const parameters = new URLSearchParams({
            handler: "GoogleMap",
            zoom: String(mapState.zoom || 18)
        });
        if (Number.isFinite(mapState.latitude) && Number.isFinite(mapState.longitude)) {
            parameters.set("latitude", String(mapState.latitude));
            parameters.set("longitude", String(mapState.longitude));
        } else {
            parameters.set("address", elements.mapAddress.value.trim());
        }

        const response = await fetch(`${window.location.pathname}?${parameters}`, { headers: { Accept: "image/*, application/json" } });
        if (!response.ok) {
            let message = "The selected map view could not be prepared for the diagram.";
            if (response.headers.get("content-type")?.includes("application/json")) {
                const error = await response.json();
                if (error?.message) message = error.message;
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error("Google Maps did not return a map image.");
        const dataUrl = await blobToDataUrl(blob);
        const mapImage = await fabricImageFromUrl(dataUrl);
        mapImage.set({
            left: 0,
            top: 0,
            originX: "left",
            originY: "top",
            scaleX: CANVAS_WIDTH / mapImage.width,
            scaleY: CANVAS_HEIGHT / mapImage.height,
            selectable: false,
            evented: false
        });

        await new Promise(resolve => canvas.setBackgroundImage(mapImage, resolve));
        preservedMapBackground = mapImage;
        canvas.backgroundColor = "#ffffff";
        canvas.requestRenderAll();
    }

    async function finishMapNavigation() {
        if (!mapNavigationActive) return true;
        elements.mapNavigationBtn.disabled = true;
        setMapStatus("Preparing this map view for editing and PDF export…");
        try {
            await requestStaticMapSnapshot();
            leaveMapNavigationWithoutSnapshot();
            mapState.enabled = true;
            saveHistory();
            autosave();
            setMapStatus("Map locked. You can now select and move vehicles or other objects.", "success");
            showToast("Map position updated");
            return true;
        } catch (error) {
            setMapStatus(error.message || "The map view could not be prepared.", "error");
            return false;
        } finally {
            elements.mapNavigationBtn.disabled = false;
        }
    }

    function renderAddressSuggestions(suggestions) {
        currentSuggestions = suggestions.filter(item => item.placePrediction).slice(0, 6);
        elements.mapAddressSuggestions.replaceChildren();
        currentSuggestions.forEach((suggestion, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-suggestion";
            button.dataset.suggestionIndex = String(index);
            const icon = document.createElement("i");
            icon.className = "bi bi-geo-alt";
            const text = document.createElement("span");
            text.textContent = suggestion.placePrediction.text?.toString() || "Suggested location";
            button.append(icon, text);
            elements.mapAddressSuggestions.appendChild(button);
        });
        const hasSuggestions = currentSuggestions.length > 0;
        elements.mapAddressSuggestions.classList.toggle("d-none", !hasSuggestions);
        elements.mapAddress.setAttribute("aria-expanded", String(hasSuggestions));
    }

    async function fetchAddressSuggestions(query) {
        await ensureGoogleMap();
        const request = { input: query, sessionToken: autocompleteSessionToken };
        const bounds = googleMap.getBounds();
        if (bounds) request.locationBias = bounds;
        const result = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        return result.suggestions || [];
    }

    async function selectAddressSuggestion(index) {
        const suggestion = currentSuggestions[index];
        const prediction = suggestion?.placePrediction;
        if (!prediction) return false;
        setMapStatus("Opening the selected address…");
        try {
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "location"] });
            if (!place.location) throw new Error("That suggestion does not have a map location.");
            const address = place.formattedAddress || prediction.text?.toString() || elements.mapAddress.value.trim();
            elements.mapAddress.value = address;
            elements.location.value = address;
            mapState = {
                enabled: true,
                address,
                zoom: Number(elements.mapZoom.value) || 18,
                latitude: place.location.lat(),
                longitude: place.location.lng()
            };
            hideAddressSuggestions();
            autocompleteSessionToken = new placesLibrary.AutocompleteSessionToken();
            if (!(await startMapNavigation())) return false;
            googleMap.setCenter(place.location);
            googleMap.setZoom(mapState.zoom);
            autosave();
            return true;
        } catch (error) {
            setMapStatus(error.message || "That address could not be opened.", "error");
            return false;
        }
    }

    async function updateAddressSuggestions() {
        const query = elements.mapAddress.value.trim();
        if (query.length < 3) {
            hideAddressSuggestions();
            return;
        }
        try {
            if (!mapNavigationActive && !(await startMapNavigation())) return;
            const suggestions = await fetchAddressSuggestions(query);
            if (elements.mapAddress.value.trim() !== query) return;
            renderAddressSuggestions(suggestions);
        } catch (error) {
            hideAddressSuggestions();
            setMapStatus(error.message || "Address suggestions are unavailable.", "error");
        }
    }

    async function findAddress() {
        const query = elements.mapAddress.value.trim();
        if (!query) {
            setMapStatus("Enter a street address first.", "error");
            elements.mapAddress.focus();
            return;
        }
        elements.loadMapBtn.disabled = true;
        setMapStatus("Finding the address…");
        try {
            const suggestions = await fetchAddressSuggestions(query);
            renderAddressSuggestions(suggestions);
            if (!currentSuggestions.length) throw new Error("No matching address was found.");
            await selectAddressSuggestion(0);
        } catch (error) {
            setMapStatus(error.message || "The address could not be found.", "error");
        } finally {
            elements.loadMapBtn.disabled = false;
        }
    }

    function useBlankCanvas() {
        hideAddressSuggestions();
        leaveMapNavigationWithoutSnapshot();
        preservedMapBackground = null;
        mapState = { enabled: false, address: "", zoom: 18, latitude: null, longitude: null };
        elements.googleMapPanel.classList.add("d-none");
        canvas.setBackgroundImage(null, () => {
            canvas.backgroundColor = "#ffffff";
            canvas.requestRenderAll();
            saveHistory();
            autosave();
        });
        setMapStatus("Search for an address, then drag or zoom the map.");
    }

    async function saveDiagram() {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        const content = JSON.stringify(makeDocument(), null, 2);
        const name = safeFileName(elements.reportNumber.value, `accident-diagram-${new Date().toISOString().slice(0, 10)}`);
        downloadBlob(new Blob([content], { type: "application/json" }), `${name}.json`);
        showToast("Editable diagram saved");
    }

    function openDiagram(file) {
        if (!file) return;
        if (mapNavigationActive) leaveMapNavigationWithoutSnapshot();
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const documentData = JSON.parse(String(event.target.result));
                if (!documentData.canvas || typeof documentData.canvas !== "object") throw new Error("Canvas data is missing.");
                applyReport(documentData.report);
                applyMapState(documentData.map);
                selectSceneTheme(documentData.sceneTheme, false);
                loadCanvasState(documentData.canvas, () => {
                    resetHistory();
                    autosave();
                    showToast("Diagram opened");
                });
            } catch (error) {
                window.alert(`This file is not a valid accident diagram. ${error.message}`);
            } finally {
                elements.loadFile.value = "";
            }
        };
        reader.readAsText(file);
    }

    function clearDiagram() {
        leaveMapNavigationWithoutSnapshot();
        hideAddressSuggestions();
        preservedMapBackground = null;
        historyLocked = true;
        canvas.clear();
        canvas.backgroundColor = "#ffffff";
        canvas.renderAll();
        historyLocked = false;
        objectSequence = 1;
        selectSceneTheme("color", false);
        applyReport({ date: localDateValue(), time: localTimeValue() });
        applyMapState({ enabled: false, address: "", zoom: 18, latitude: null, longitude: null });
        setMapStatus("Search for an address, then drag or zoom the map.");
        resetHistory();
        updatePropertiesPanel();
        autosave();
    }

    function fitPdfText(doc, value, maxWidth, maximumSize = 8.3, minimumSize = 5.8) {
        const original = String(value || "-");
        let fontSize = maximumSize;
        doc.setFontSize(fontSize);
        while (fontSize > minimumSize && doc.getTextWidth(original) > maxWidth) {
            fontSize -= .25;
            doc.setFontSize(fontSize);
        }
        if (doc.getTextWidth(original) <= maxWidth) return { text: original, fontSize };
        let shortened = original;
        while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) shortened = shortened.slice(0, -1);
        return { text: `${shortened}...`, fontSize };
    }

    function drawPdfInlineField(doc, label, value, x, y, width, height = 8.7) {
        // Draw label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);
        doc.setTextColor(82, 94, 112);
        const labelText = label.toUpperCase();
        const labelX = x;
        const labelY = y + 2.5;
        doc.text(labelText, labelX, labelY);

        // Draw underline for value
        const lineY = y + height - 1.5;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(x, lineY, x + width, lineY);

        // Draw value above the line
        doc.setFont("helvetica", "normal");
        doc.setTextColor(28, 37, 54);
        const valueY = y + 6.5;
        const fitted = fitPdfText(doc, value, width);
        doc.setFontSize(fitted.fontSize);
        doc.text(fitted.text, x, valueY);

        // Reset line width
        doc.setLineWidth(0.2);
    }

    function drawPdfInlineRow(doc, fields, widths, y, startX = 10, gap = 1.5) {
        let x = startX;
        fields.forEach((field, index) => {
            drawPdfInlineField(doc, field.label, field.value, x, y, widths[index]);
            x += widths[index] + gap;
        });
    }

    function formatReportDate(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[2]}/${match[3]}/${match[1]}` : String(value || "");
    }

    function formatReportTime(value) {
        const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
        if (!match) return String(value || "");
        const hour = Number(match[1]);
        return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
    }

    async function generatePdf() {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        if (!window.jspdf?.jsPDF) {
            window.alert("The PDF library could not be loaded. Check your internet connection and refresh the page.");
            return;
        }
        const report = collectReport();
        const previousActive = activeObject();
        canvas.discardActiveObject();
        canvas.renderAll();

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;

            drawPdfInlineRow(doc, [
                { label: "Date", value: formatReportDate(report.date) },
                { label: "Time", value: formatReportTime(report.time) },
                { label: "Route", value: report.route },
                { label: "Run", value: report.run },
                { label: "Operator/Empl", value: report.operatorEmployee },
                { label: "Pass/PR#", value: report.operatorPassPrNumber },
                { label: "Bus/VH#", value: report.busVehicleNumber }
            ], [34, 29, 30, 24, 68, 41, 42], 10);

            drawPdfInlineRow(doc, [
                { label: "Destination", value: report.location },
                { label: "SLD/Manager", value: report.sldManager },
                { label: "Pass/PR#", value: report.managerPassPrNumber }
            ], [149, 78, 47], 20.7);

            doc.setDrawColor(207, 215, 226);
            //doc.line(margin, 32, pageWidth - margin, 32);

            const image = canvas.toDataURL({ format: "png", multiplier: 2, enableRetinaScaling: true });
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = 160;
            const imageRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
            let imageWidth = maxWidth;
            let imageHeight = imageWidth / imageRatio;
            if (imageHeight > maxHeight) { imageHeight = maxHeight; imageWidth = imageHeight * imageRatio; }
            const imageX = (pageWidth - imageWidth) / 2;
            doc.setDrawColor(170, 181, 196);
            doc.rect(imageX - .5, 35, imageWidth + 1, imageHeight + 1);
            doc.addImage(image, "PNG", imageX, 35.5, imageWidth, imageHeight, undefined, "FAST");

            doc.setDrawColor(220, 225, 232);
            doc.line(margin, 202, pageWidth - margin, 202);
            doc.setFontSize(7);
            doc.setTextColor(115, 124, 138);
            doc.text(`Created ${new Date().toLocaleString()}`, margin, 206.5);
            doc.text("Diagram is illustrative and should be reviewed for accuracy.", pageWidth - margin, 206.5, { align: "right" });

            const fileName = `${safeFileName(report.reportNumber, `accident-report-${new Date().toISOString().slice(0, 10)}`)}.pdf`;
            doc.save(fileName);
            showToast("PDF downloaded");
        } catch (error) {
            console.error(error);
            window.alert("The PDF could not be generated. Please try again.");
        } finally {
            if (previousActive) canvas.setActiveObject(previousActive);
            canvas.requestRenderAll();
        }
    }

    function restoreAutosave() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return false;
            const documentData = JSON.parse(raw);
            if (!documentData.canvas) return false;
            applyReport(documentData.report);
            applyMapState(documentData.map);
            selectSceneTheme(documentData.sceneTheme, false);
            loadCanvasState(documentData.canvas, resetHistory);
            return true;
        } catch { return false; }
    }

    document.querySelectorAll(".asset-item").forEach(item => {
        item.addEventListener("click", async () => {
            if (mapNavigationActive && !(await finishMapNavigation())) return;
            addAsset(item.dataset.asset);
        });
        item.addEventListener("dragstart", event => {
            event.dataTransfer.setData("text/plain", item.dataset.asset);
            event.dataTransfer.effectAllowed = "copy";
        });
    });

    elements.canvasViewport.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
    elements.canvasViewport.addEventListener("drop", async event => {
        event.preventDefault();
        const assetType = event.dataTransfer.getData("text/plain");
        const upperCanvas = elements.canvasStage.querySelector(".upper-canvas");
        if (!upperCanvas) return;
        const bounds = upperCanvas.getBoundingClientRect();
        const left = Math.max(0, Math.min(CANVAS_WIDTH, (event.clientX - bounds.left) / zoom));
        const top = Math.max(0, Math.min(CANVAS_HEIGHT, (event.clientY - bounds.top) / zoom));
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        addAsset(assetType, left, top);
    });

    elements.assetSearch.addEventListener("input", () => {
        const query = elements.assetSearch.value.trim().toLowerCase();
        document.querySelectorAll(".asset-item").forEach(item => item.classList.toggle("filtered-out", !item.dataset.name.toLowerCase().includes(query)));
        document.querySelectorAll(".asset-section").forEach(section => section.classList.toggle("filtered-out", !section.querySelector(".asset-item:not(.filtered-out)")));
    });

    canvas.on("selection:created", updatePropertiesPanel);
    canvas.on("selection:updated", updatePropertiesPanel);
    canvas.on("selection:cleared", updatePropertiesPanel);
    canvas.on("mouse:down", event => {
        if (!["line", "measure"].includes(interactionMode)) return;
        const pointer = canvas.getPointer(event.e);
        lineStart = { x: pointer.x, y: pointer.y };
        lineEnd = { ...lineStart };
        const isMeasurement = interactionMode === "measure";
        previewLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: isMeasurement ? "#2458d3" : "#1f2937",
            strokeWidth: isMeasurement ? 3 : 4,
            strokeDashArray: isMeasurement ? [8, 5] : null,
            strokeLineCap: "round",
            selectable: false,
            evented: false,
            objectCaching: false,
            assetType: isMeasurement ? "measurement-preview" : "straight-line",
            displayName: isMeasurement ? "Measurement preview" : `Straight Line ${objectSequence++}`,
            strokeColorable: true,
            selectedColor: "#1f2937"
        });
        historyLocked = true;
        canvas.add(previewLine);
        historyLocked = false;
    });
    canvas.on("mouse:move", event => {
        if (!["line", "measure"].includes(interactionMode) || !previewLine) return;
        const pointer = canvas.getPointer(event.e);
        lineEnd = { x: pointer.x, y: pointer.y };
        previewLine.set({ x2: pointer.x, y2: pointer.y });
        previewLine.setCoords();
        canvas.requestRenderAll();
    });
    canvas.on("mouse:up", () => {
        if (!["line", "measure"].includes(interactionMode) || !previewLine || !lineStart || !lineEnd) return;
        const length = Math.hypot(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y);
        if (length < 3) {
            cancelPreviewLine();
            return;
        }
        if (interactionMode === "measure") {
            const start = { ...lineStart };
            const end = { ...lineEnd };
            historyLocked = true;
            canvas.remove(previewLine);
            previewLine = null;
            lineStart = null;
            lineEnd = null;
            const measurement = createMeasurementLineBetween(start, end);
            applySceneThemeToObject(measurement);
            canvas.add(measurement);
            measurement.setCoords();
            historyLocked = false;
            setInteractionMode("select");
            canvas.setActiveObject(measurement);
            canvas.requestRenderAll();
            updatePropertiesPanel();
            saveHistory();
            showToast("Measurement added — enter the actual distance in Properties");
            return;
        }
        previewLine.set({ selectable: true, evented: true });
        previewLine.setCoords();
        previewLine = null;
        lineStart = null;
        lineEnd = null;
        canvas.requestRenderAll();
        saveHistory();
    });
    canvas.on("object:added", event => {
        const object = event.target;
        if (!historyLocked && sceneTheme === "monochrome" && interactionMode === "freehand" && object?.type === "path") {
            object.themeOriginalStroke = "#d22f2f";
            object.set("stroke", monochromeColor(object.themeOriginalStroke));
        }
        saveHistory();
    });
    canvas.on("object:moving", event => {
        snapRoadToNearbyEndpoint(event.target);
        syncVehicleLabelsForTarget(event.target);
    });
    canvas.on("object:scaling", event => syncVehicleLabelsForTarget(event.target));
    canvas.on("object:rotating", event => {
        if (event.target?.type === "activeSelection") {
            syncVehicleLabelsForTarget(event.target);
            return;
        }
        if (isBaseRoad(event.target)) {
            snapRoadRotation(event.target);
            return;
        }
        if (!isVehicle(event.target)) return;
        event.target.directionOfTravel = directionFromAngle(event.target.angle);
        syncVehicleUnitLabel(event.target);
    });
    canvas.on("object:modified", event => {
        const object = event.target;
        syncVehicleLabelsForTarget(object);
        saveHistory();
        updatePropertiesPanel();
        if (object?._roadEndpointSnapNotice) showToast(`Road connected to ${object._roadEndpointSnapNotice}`);
        else if (object?._roadRotationSnapNotice != null) showToast(`Road angle snapped to ${Math.round(normalizeAngle(object.angle))}°`);
        if (object) {
            delete object._roadEndpointSnapNotice;
            delete object._roadRotationSnapNotice;
        }
    });
    canvas.on("object:removed", saveHistory);
    canvas.on("path:created", saveHistory);

    elements.templateBtn.addEventListener("click", () => {
        if (!window.bootstrap) {
            window.alert("The template picker could not be opened. Refresh the page and try again.");
            return;
        }
        templateModalInstance ??= new bootstrap.Modal(elements.templateModal);
        templateModalInstance.show();
    });
    document.querySelectorAll("[data-crash-template]").forEach(button => {
        button.addEventListener("click", () => applyCrashTemplate(button.dataset.crashTemplate));
    });
    elements.undoBtn.addEventListener("click", undo);
    elements.redoBtn.addEventListener("click", redo);
    elements.selectBtn.addEventListener("click", async () => {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode("select");
    });
    elements.selectAllBtn.addEventListener("click", selectAllObjects);
    elements.drawBtn.addEventListener("click", async () => {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode(interactionMode === "freehand" ? "select" : "freehand");
    });
    elements.lineBtn.addEventListener("click", async () => {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode(interactionMode === "line" ? "select" : "line");
    });
    elements.measureBtn.addEventListener("click", async () => {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode(interactionMode === "measure" ? "select" : "measure");
        if (interactionMode === "measure") showToast("Drag between two points, then enter the measured distance in Properties");
    });
    elements.addTextBtn.addEventListener("click", async () => {
        if (mapNavigationActive && !(await finishMapNavigation())) return;
        setInteractionMode("select");
        addAsset("text");
    });
    elements.deleteBtn.addEventListener("click", deleteSelected);
    elements.duplicateBtn.addEventListener("click", duplicateSelected);
    elements.rotateLeftBtn.addEventListener("click", () => rotateActive(-15));
    elements.rotateRightBtn.addEventListener("click", () => rotateActive(15));
    elements.flipBtn.addEventListener("click", () => {
        const active = activeObject(); if (!active) return;
        if (isLocked(active)) {
            showToast("Unlock this object before flipping it");
            return;
        }
        active.set("flipX", !active.flipX); canvas.requestRenderAll(); saveHistory();
    });
    elements.frontBtn.addEventListener("click", () => {
        const active = activeObject(); if (!active) return;
        active.bringToFront();
        enforceAutomaticRoadLayering();
        canvas.requestRenderAll();
        saveHistory();
        if (isBaseRoad(active)) showToast("Roads remain behind vehicles and other scene details");
    });
    elements.backBtn.addEventListener("click", () => {
        const active = activeObject(); if (!active) return;
        active.sendToBack();
        enforceAutomaticRoadLayering();
        canvas.requestRenderAll();
        saveHistory();
    });

    elements.objectLabel.addEventListener("change", () => {
        const active = activeObject(); if (!active) return;
        active.displayName = elements.objectLabel.value.trim() || "Object";
        elements.selectedObjectName.textContent = active.displayName;
        saveHistory();
    });
    elements.streetNameText.addEventListener("input", () => {
        const active = activeObject();
        const streetText = findStreetNameText(active);
        if (!streetText) return;
        const value = elements.streetNameText.value.trimStart().toUpperCase() || "STREET NAME";
        streetText.set({ text: value, fontSize: streetNameFontSize(value) });
        streetText.initDimensions?.();
        active.dirty = true;
        active.setCoords();
        canvas.requestRenderAll();
    });
    elements.streetNameText.addEventListener("change", saveHistory);
    elements.speedLimitValue.addEventListener("input", () => {
        const active = activeObject();
        const speedText = findSpeedLimitText(active);
        if (!speedText) return;
        const rawValue = elements.speedLimitValue.value;
        const speed = rawValue === "" ? "--" : String(Math.min(99, Math.max(1, Number(rawValue) || 1)));
        speedText.set("text", `SPEED\nLIMIT\n${speed}`);
        speedText.initDimensions?.();
        active.dirty = true;
        active.setCoords();
        canvas.requestRenderAll();
    });
    elements.speedLimitValue.addEventListener("change", () => {
        const normalized = Math.min(99, Math.max(1, Number(elements.speedLimitValue.value) || 35));
        elements.speedLimitValue.value = String(normalized);
        const speedText = findSpeedLimitText(activeObject());
        if (speedText) speedText.set("text", `SPEED\nLIMIT\n${normalized}`);
        canvas.requestRenderAll();
        saveHistory();
    });
    elements.textFontFamily.addEventListener("change", () => {
        const active = activeObject();
        if (!active || active.type !== "i-text") return;
        active.set("fontFamily", elements.textFontFamily.value);
        canvas.requestRenderAll();
        saveHistory();
    });
    elements.textFontSize.addEventListener("input", () => {
        const active = activeObject();
        if (!active || active.type !== "i-text") return;
        const size = Number(elements.textFontSize.value);
        if (!Number.isFinite(size)) return;
        active.set("fontSize", Math.min(120, Math.max(8, size)));
        canvas.requestRenderAll();
    });
    elements.textFontSize.addEventListener("change", () => {
        const active = activeObject();
        if (!active || active.type !== "i-text") return;
        const normalized = Math.min(120, Math.max(8, Math.round(Number(elements.textFontSize.value)) || 28));
        elements.textFontSize.value = String(normalized);
        active.set("fontSize", normalized);
        canvas.requestRenderAll();
        saveHistory();
    });
    elements.textBoldBtn.addEventListener("click", () => {
        const active = activeObject();
        if (!active || active.type !== "i-text") return;
        const isBold = parseInt(active.fontWeight, 10) >= 700 || active.fontWeight === "bold";
        active.set("fontWeight", isBold ? "400" : "700");
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
    });
    elements.textItalicBtn.addEventListener("click", () => {
        const active = activeObject();
        if (!active || active.type !== "i-text") return;
        const isItalic = active.fontStyle === "italic";
        active.set("fontStyle", isItalic ? "normal" : "italic");
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
    });
    elements.measurementLabelText.addEventListener("input", () => {
        const measurement = activeObject();
        const measurementText = findMeasurementText(measurement);
        if (!measurementText) return;
        const value = elements.measurementLabelText.value.trimStart() || "Distance";
        measurement.measurementLabel = value;
        updateEmbeddedLabel(measurement, measurementText, value, Math.max(100, Number(measurement.width) - 24));
    });
    elements.measurementLabelText.addEventListener("change", () => {
        const measurement = activeObject();
        const measurementText = findMeasurementText(measurement);
        if (!measurementText) return;
        const value = elements.measurementLabelText.value.trim() || "Distance";
        elements.measurementLabelText.value = value;
        measurement.measurementLabel = value;
        updateEmbeddedLabel(measurement, measurementText, value, Math.max(100, Number(measurement.width) - 24));
        saveHistory();
    });
    elements.vehicleUnitNumber.addEventListener("input", () => {
        const vehicle = activeObject();
        if (!isVehicle(vehicle)) return;
        const value = Number(elements.vehicleUnitNumber.value);
        if (!Number.isFinite(value) || value < 1) return;
        vehicle.vehicleUnitNumber = Math.min(999, Math.round(value));
        syncVehicleUnitLabel(vehicle);
        canvas.requestRenderAll();
    });
    elements.vehicleUnitNumber.addEventListener("change", () => {
        const vehicle = activeObject();
        if (!isVehicle(vehicle)) return;
        const value = Math.min(999, Math.max(1, Math.round(Number(elements.vehicleUnitNumber.value) || vehicle.vehicleUnitNumber || 1)));
        vehicle.vehicleUnitNumber = value;
        elements.vehicleUnitNumber.value = String(value);
        syncVehicleUnitLabel(vehicle);
        canvas.requestRenderAll();
        saveHistory();
    });
    elements.vehicleDirection.addEventListener("change", () => {
        const vehicle = activeObject();
        if (!isVehicle(vehicle)) return;
        const direction = elements.vehicleDirection.value;
        vehicle.directionOfTravel = direction;
        const directionOption = VEHICLE_DIRECTIONS[direction];
        if (directionOption && directionOption.angle !== null) vehicle.rotate(directionOption.angle);
        vehicle.setCoords();
        syncVehicleUnitLabel(vehicle);
        elements.angleInput.value = Math.round(vehicle.angle || 0);
        canvas.requestRenderAll();
        saveHistory();
    });
    elements.objectLockedToggle.addEventListener("change", () => {
        const active = activeObject();
        if (!active || active.type === "activeSelection") return;
        const locked = elements.objectLockedToggle.checked;
        setObjectLocked(active, locked);
        canvas.requestRenderAll();
        updatePropertiesPanel();
        saveHistory();
        showToast(locked
            ? "Object locked — it can still be selected, but it cannot be moved, resized or rotated"
            : isBaseRoad(active)
                ? "Road unlocked — endpoint and 45° rotation snapping are active"
                : "Object unlocked");
    });
    elements.lockAllRoadsBtn.addEventListener("click", () => setAllRoadLocks(true));
    elements.unlockAllRoadsBtn.addEventListener("click", () => setAllRoadLocks(false));
    elements.fillColor.addEventListener("input", () => {
        const active = activeObject(); if (!active) return;
        active.set("selectedColor", elements.fillColor.value);
        forEachColorable(active, item => {
            const property = item.strokeColorable ? "stroke" : "fill";
            const originalProperty = item.strokeColorable ? "themeOriginalStroke" : "themeOriginalFill";
            // Mark that user has manually overridden the color
            item.userColorOverride = true;
            // Store the original color and apply it directly (no monochrome conversion)
            item[originalProperty] = elements.fillColor.value;
            item.set(property, elements.fillColor.value);
        });
        canvas.requestRenderAll();
    });
    elements.fillColor.addEventListener("change", saveHistory);
    elements.opacityRange.addEventListener("input", () => {
        const active = activeObject(); if (!active) return;
        active.set("opacity", Number(elements.opacityRange.value) / 100);
        syncVehicleUnitLabel(active);
        elements.opacityValue.textContent = `${elements.opacityRange.value}%`;
        canvas.requestRenderAll();
    });
    elements.opacityRange.addEventListener("change", saveHistory);
    elements.angleInput.addEventListener("change", () => {
        const active = activeObject(); if (!active) return;
        if (isLocked(active)) {
            elements.angleInput.value = Math.round(active.angle || 0);
            showToast("Unlock this object before rotating it");
            return;
        }
        const requestedAngle = Number(elements.angleInput.value);
        if (!Number.isFinite(requestedAngle)) return;
        active.rotate(requestedAngle);
        active.setCoords();
        if (isVehicle(active)) {
            active.directionOfTravel = directionFromAngle(active.angle);
            elements.vehicleDirection.value = active.directionOfTravel;
            syncVehicleUnitLabel(active);
        }
        elements.angleInput.value = String(requestedAngle);
        canvas.requestRenderAll(); saveHistory();
        if (isBaseRoad(active)) showToast(`Road angle set to ${requestedAngle}°`);
    });

    elements.zoomOutBtn.addEventListener("click", () => setZoom(zoom - .1));
    elements.zoomInBtn.addEventListener("click", () => setZoom(zoom + .1));
    elements.zoomResetBtn.addEventListener("click", () => setZoom(1));
    elements.gridToggle.addEventListener("change", () => elements.canvasViewport.classList.toggle("show-grid", elements.gridToggle.checked));
    elements.sceneTheme.addEventListener("change", () => {
        selectSceneTheme(elements.sceneTheme.value);
        autosave();
        showToast(sceneTheme === "monochrome" ? "Monochrome theme applied" : "Full Color theme restored");
    });
    elements.googleMapMode.addEventListener("change", async () => {
        if (!elements.googleMapMode.checked) return;
        mapState.enabled = true;
        elements.googleMapPanel.classList.remove("d-none");
        setMapStatus("Loading the interactive map…");
        await startMapNavigation();
        elements.mapAddress.focus();
        autosave();
    });
    elements.blankCanvasMode.addEventListener("change", () => {
        if (elements.blankCanvasMode.checked) useBlankCanvas();
    });
    elements.loadMapBtn.addEventListener("click", findAddress);
    elements.mapNavigationBtn.addEventListener("click", async () => {
        if (mapNavigationActive) await finishMapNavigation();
        else await startMapNavigation();
    });
    elements.mapAddress.addEventListener("input", () => {
        mapState.address = elements.mapAddress.value.trim();
        clearTimeout(autocompleteTimer);
        autocompleteTimer = setTimeout(updateAddressSuggestions, 280);
    });
    elements.mapAddress.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        findAddress();
    });
    elements.mapAddress.addEventListener("change", () => {
        mapState.address = elements.mapAddress.value.trim();
        autosave();
    });
    elements.mapAddressSuggestions.addEventListener("click", event => {
        const button = event.target.closest("[data-suggestion-index]");
        if (!button) return;
        selectAddressSuggestion(Number(button.dataset.suggestionIndex));
    });
    elements.mapZoom.addEventListener("change", () => {
        mapState.zoom = Number(elements.mapZoom.value) || 18;
        if (googleMap && mapNavigationActive) googleMap.setZoom(mapState.zoom);
        autosave();
    });
    elements.saveBtn.addEventListener("click", saveDiagram);
    elements.loadFile.addEventListener("change", () => openDiagram(elements.loadFile.files[0]));
    elements.pdfBtn.addEventListener("click", generatePdf);
    elements.newBtn.addEventListener("click", () => {
        if (canvas.getObjects().length === 0) { clearDiagram(); return; }
        if (window.bootstrap) { confirmModalInstance ??= new bootstrap.Modal(elements.confirmModal); confirmModalInstance.show(); }
        else if (window.confirm("Clear the current diagram?")) clearDiagram();
    });
    elements.confirmNewBtn.addEventListener("click", () => { confirmModalInstance?.hide(); clearDiagram(); showToast("New diagram started"); });
    reportInputs.forEach(input => input.addEventListener("change", autosave));

    document.addEventListener("pointerdown", event => {
        if (!elements.mapAddress.parentElement.contains(event.target)) hideAddressSuggestions();
    });

    document.addEventListener("keydown", event => {
        const target = event.target;
        const editingField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
        if (editingField) return;
        const active = activeObject();
        if ((event.key === "Delete" || event.key === "Backspace") && active) { event.preventDefault(); deleteSelected(); return; }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") { event.preventDefault(); selectAllObjects(); return; }
        if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
        if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
        if (event.ctrlKey && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
        if (event.key === "Escape") { setInteractionMode("select"); canvas.discardActiveObject(); canvas.requestRenderAll(); return; }
        if (active && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            if (isLocked(active)) {
                showToast("Unlock this object before moving it");
                return;
            }
            const step = event.shiftKey ? 10 : 1;
            if (event.key === "ArrowLeft") active.left -= step;
            if (event.key === "ArrowRight") active.left += step;
            if (event.key === "ArrowUp") active.top -= step;
            if (event.key === "ArrowDown") active.top += step;
            active.setCoords(); syncVehicleLabelsForTarget(active); canvas.requestRenderAll(); saveHistory();
        }
    });

    elements.accidentDate.value = localDateValue();
    elements.accidentTime.value = localTimeValue();
    applyMapState({ enabled: false, address: "", zoom: 18, latitude: null, longitude: null });
    selectSceneTheme("color", false);
    updateMapNavigationButton();
    setInteractionMode("select");
    setZoom(1);
    if (!restoreAutosave()) resetHistory();
    updateObjectCount();
    updatePropertiesPanel();
})();
