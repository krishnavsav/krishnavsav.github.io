require([
  "esri/WebScene",
  "esri/views/SceneView",
  "esri/widgets/Bookmarks",
  "esri/core/reactiveUtils"
], function (WebScene, SceneView, Bookmarks, reactiveUtils) {

  // --- Global defaults if a slide has no description ---
  const loop = false;      // don't loop by default
  const dwellMs = 3000;    // default time to wait on each slide (ms)
  const animMs = 2500;     // default camera flight duration (ms)

  const scene = new WebScene({
    // your scene item
    portalItem: { id: "b9d2c0e43f604f6daaaa29ffdeb71f32" }
  });

  const view = new SceneView({
    container: "viewDiv",
    map: scene
  });

  const bookmarks = new Bookmarks({ view }); // optional
  // view.ui.add(bookmarks, "top-right");

  view.when(() => {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.style.display = "none";
  });

  // --- UI control ---
  let playing = false;
  let i = 0;

  const ctrl = document.createElement("div");
  ctrl.className = "tour-ctrl";

  const btn = document.createElement("button");
  btn.textContent = "Play tour";

  ctrl.appendChild(btn);
  view.ui.add(ctrl, "top-right");

  btn.addEventListener("click", () => {
    if (!playing) {
      playing = true;
      btn.textContent = "Pause tour";
      playSlides();
    } else {
      playing = false;
      btn.textContent = "Play tour";
    }
  });

  // --- helpers for slides ---
  function getTitle(slide) {
    return slide?.title?.text ?? slide?.title ?? "";
  }

  function getDesc(slide) {
    return slide?.description?.text ?? slide?.description ?? "";
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showMessage(text) {
    let msg = document.getElementById("messageDiv");

    if (!msg) {
      msg = document.createElement("div");
      msg.id = "messageDiv";
      document.body.appendChild(msg);
    }

    msg.textContent = text || "";
  }

  // Parse timing from the Description field
  // Supports:
  // "5000"
  // "dwell=7000 anim=3000"
  // "anim:2000 dwell:4500"
  // JSON: {"dwell":6000,"anim":2000}
  function parseTimingFromDesc(desc) {
    if (!desc) return {};

    const s = String(desc).trim();

    // pure number => dwell
    if (/^\d+$/.test(s)) {
      return { dwell: parseInt(s, 10) };
    }

    // key=value or key:value
    const kv = s.match(/dwell\s*[:=]\s*(\d+)/i);
    const ka = s.match(/anim(?:ation)?\s*[:=]\s*(\d+)/i);

    if (kv || ka) {
      return {
        dwell: kv ? parseInt(kv[1], 10) : undefined,
        anim: ka ? parseInt(ka[1], 10) : undefined
      };
    }

    // JSON
    try {
      const j = JSON.parse(s);
      const d = Number(j.dwell);
      const a = Number(j.anim ?? j.animation);

      return {
        dwell: Number.isFinite(d) ? d : undefined,
        anim: Number.isFinite(a) ? a : undefined
      };
    } catch {
      return {};
    }
  }

  async function ensureSlidesReady() {
    await scene.when();

    await reactiveUtils.whenOnce(() => {
      const s = scene.presentation?.slides;
      return s && s.length > 0;
    });

    return scene.presentation.slides;
  }

  async function playSlides() {
    const slides = await ensureSlidesReady();

    if (!slides || slides.length === 0) {
      showMessage("No slides found in this scene.");
      playing = false;
      btn.textContent = "Play tour";
      return;
    }

    if (i >= slides.length) i = 0;

    while (playing && i < slides.length) {
      const slide = slides.getItemAt(i);

      // Read per-slide timing from Description
      const { dwell, anim } = parseTimingFromDesc(getDesc(slide));

      const dwellForThisSlide = Number.isFinite(dwell) ? dwell : dwellMs;
      const animForThisSlide = Number.isFinite(anim) ? anim : animMs;

      // fly the camera
      await slide.applyTo(view, {
        animate: true,
        duration: animForThisSlide
      });

      // show only the TITLE
      showMessage(getTitle(slide));

      // wait
      await delay(dwellForThisSlide);

      i++;
    }

    if (!loop && i >= slides.length) {
      playing = false;
      btn.textContent = "Play tour";
    }
  }

  // Auto-start when slides are ready
  (async () => {
    const slides = await ensureSlidesReady();

    if (slides && slides.length > 0) {
      playing = true;
      btn.textContent = "Pause tour";
      playSlides();
    }
  })();

});