import { ctx, toggleMenu } from './state.js';
import { load_from_url, media_populate } from './media.js';
import media from './mediaData.js';
import init_gui from './gui.js';
import { onResize } from './resize.js'
import init_shaders from './init_shaders.js'
import render from './render.js'
import { key_input, setup_input } from './input.js'
import { openTab } from './tabs.js'

ctx.canvas = document.querySelector("canvas");
/* Since we draw over the whole screen, no need to flush */
ctx.gl = ctx.canvas.getContext('webgl', { preserveDrawingBuffer: false });

function main() {
	if (ctx.gl)
		console.log(
			"WebGL Version: " + ctx.gl.getParameter(ctx.gl.VERSION) + '\n' +
			"Vendor: " + ctx.gl.getParameter(ctx.gl.VENDOR) + '\n' +
			"Renderer: " + ctx.gl.getParameter(ctx.gl.RENDERER) + '\n' +
			"GLSL Version: " +
			ctx.gl.getParameter(ctx.gl.SHADING_LANGUAGE_VERSION) + '\n' +
			"Max tex-size: " +
			ctx.gl.getParameter(ctx.gl.MAX_TEXTURE_SIZE) + "px²");
	else {
		console.error("No WebGl context received.");
		return;
	}

	init();
}

function init() {
	ctx.canvasToDisplaySizeMap = new Map([[ctx.canvas, [300, 150]]]);
	const resizeObserver = new ResizeObserver(onResize);
	resizeObserver.observe(ctx.canvas, { box: 'content-box' });

	/* Input handlers */

	init_gui();
	init_shaders(ctx, ctx.gl);
	/* Add the stats */
	document.body.appendChild(ctx.stats.dom);
	document.body.appendChild(ctx.stats_events.dom);
	ctx.stats_events.dom.style.position = 'absolute';
	ctx.stats_events.dom.style.left = ctx.stats_events.dom.offsetWidth + 'px';
	ctx.stats.dom.style.display = ctx.gui.showStats ? 'block' : 'none';
	ctx.stats_events.dom.style.display =
		ctx.gui.showEventStats ? 'block' : 'none';

	ctx.gl.clearColor(0, 0, 0, 1);
	/* Prevents headaches when loading NPOT textures */
	ctx.gl.pixelStorei(ctx.gl.UNPACK_ALIGNMENT, 1);

	document.getElementById('tab_about').addEventListener(
		'click', function (event) {
			openTab(event, 'about');
		}
	);
	document.getElementById('tab_media').addEventListener(
		'click', function (event) {
			openTab(event, 'media');
		}
	);
	document.getElementById('tab_close').onclick = function () {
		toggleMenu();
	};
	document.getElementById("tab_about").click();
	media_populate();
	load_from_url(media[0]);

	setup_input();
}

/* Loop for animation only needs to happen event based. Aka photo mode with
   mouse or touch */
ctx.animate = function animate() {
	/* Will always redraw in WebCam or Video mode, but not in photo mode */
	if (!ctx.redraw || ctx.continous) {
		/* Stats for rejected events */
		ctx.stats_events.update();
		return;
	}
	ctx.redraw = false;

	render();
	requestAnimationFrame(animate);
}

/* Loop for constant rendering, like when video or webcams are viewer. Also
   needed for smooth keyboard usage */
ctx.animate_cont = function animate(time) {
	/* Keys have to be polled for smooth operation */
	key_input(time);

	render();
	if (ctx.continous)
		requestAnimationFrame(animate);
}

main();