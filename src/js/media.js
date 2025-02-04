import { ctx, ctr, redraw } from './state.js';
import media from './mediaData.js'
import media_user from './mediaData_user.js'
import { disable_video, load_video } from './media_video.js'
import { recalc_croplimits, channel2_disable, channel2_enable } from './gui.js';

export function media_populate() {
	let mediaDiv = document.getElementById('media');
	media.forEach(media => {
		let card = document.createElement('div');
		card.className = 'card';
		card.onclick = function () {
			if (ctx.loading) return;
			load_from_url(media);
			closeMenu();
		};

		let sourceLink = '';
		if (media.source) {
			sourceLink = `<p class="card-field">
			<a href="${media.source}" class="source-link" onclick="event.stopPropagation()">Source</a></p>`;
		}


		let resizeWarn = '';
		if (media.width > ctx.max_texsize || media.height > ctx.max_texsize) {
			resizeWarn = `<p class="card-field">
			<a class="value">
			Size above your GPU limit of ${ctx.max_texsize} px²<br>
			Image will be resized to fit that.
			</p>`;
		}

		card.innerHTML = `
			<div class="card-header">
				<img src="img/${media.type}.svg" class="card-icon">
				<h2 class="card-title">${media.title}</h2>
			</div>
			<img class="card-image" src="${media.thumb}" alt="Thumbnail">
			<div class="card-description">
				<p class="card-field">File Size:
					<span class="value">${media.fileSize}</span></p>
				<p class="card-field">Dimensions:
					<span class="value">${media.width}x${media.height}</span></p>
				${resizeWarn}
				${sourceLink}
			</div>`;
		mediaDiv.appendChild(card);
	});
};

export function media_populate_user() {
	let mediaDiv = document.getElementById('media_user');
	media_user.forEach(media => {
		let card = document.createElement('div');
		card.className = 'card';
		card.onclick = function () {
			if (ctx.loading) return;
			load_from_url(media);
			closeMenu();
		};

		let sourceLink = '';
		if (media.source) {
			sourceLink = `<p class="card-field">
			<a href="${media.source}" class="source-link" onclick="event.stopPropagation()">Source</a></p>`;
		}


		let resizeWarn = '';
		if (media.width > ctx.max_texsize || media.height > ctx.max_texsize) {
			resizeWarn = `<p class="card-field">
			<a class="value">
			Size above your GPU limit of ${ctx.max_texsize} px²<br>
			Image will be resized to fit that.
			</p>`;
		}

		/* Check if Link tag is needed */
		let submitterContent = media.submitter_link
			? `<a href="${media.submitter_link}" class="source-link" onclick="event.stopPropagation()">${media.submitter}</a>`
			: media.submitter;

		card.innerHTML = `
			<div class="card-header">
				<img src="img/${media.type}.svg" class="card-icon">
				<h2 class="card-title">${media.title}</h2>
			</div>
			<img class="card-image" src="${media.thumb}" alt="Thumbnail">
			<div class="card-description">
				<p class="card-field">Submitter:
					<span class="value">${submitterContent}</span></p>
				<p class="card-field">File Size:
					<span class="value">${media.fileSize}</span></p>
				<p class="card-field">Dimensions:
					<span class="value">${media.width}x${media.height}</span></p>
				${resizeWarn}
				${sourceLink}
			</div>`;
		mediaDiv.appendChild(card);
	});
};

export const user_media = {
	sphere_fov: 360,
	crop: {
		top: 0,
		bot: 0,
		left: 0,
		right: 0
	},
	world_rotation: {
		Yaw: 0,
		Pitch: 0,
		Roll: 0
	},
	camera_initial: {
		Yaw: 0,
		Pitch: 0
	},
	ch2: false
}

export function upload_image() {
	if (ctx.loading) return;
	const file_selector = document.createElement('input');
	file_selector.type = 'file';
	file_selector.accept = 'image/*';
	file_selector.onchange = function (event) {
		user_media.path = URL.createObjectURL(event.target.files[0]);
		user_media.type = "image";
		if (document.getElementById('image_multi').checked)
			user_media.ch2 = true;
		else
			user_media.ch2 = false;

		load_from_url(user_media);
		closeMenu();
	}
	file_selector.click();
};

export async function load_from_url(media) {
	ctx.loading = true;
	disable_video();
	channel2_disable();
	if (media.ch2)
		channel2_enable();

	/* On reloads, try freeing VRAM as soon as possible, since there are weird
	   effects when trying to decode  */
	ctx.gl.deleteTexture(ctx.shaders.ch1.tex);

	ctx.dom.spinner.style.display = 'block';
	ctx.gui.handle.hide();
	if (media.type == "image")
		try {
			ctx.dom.statusMSG.innerText = "Requesting " + media.path;
			const response = await fetch(media.path);
			ctx.dom.statusMSG.innerText = "Downloading " + media.path;
			ctx.dom.filesize.innerText = "(" +
				(
					(response.headers.get('Content-Length') / 1000000)
				).toFixed(2) +
				" MegaByte" + ")";
			const blob = await response.blob();
			ctx.dom.statusMSG.innerText = "Decoding image";
			ctx.dom.filesize.innerText =
				"If the app hangs here, your\n" +
				"device can load the image\n" +
				"but failed, propably low on\n" +
				"graphics memory right now."
			let bitmap;

			if (ctx.gui.eruda) var bit2_time = performance.now()
			/* Resize if outside GPU limits */
			if (media.width > ctx.max_texsize ||
				media.height > ctx.max_texsize) {
				bitmap = await createImageBitmap(blob,
					{
						resizeWidth: media.width > ctx.max_texsize ?
							ctx.max_texsize : media.width,
						resizeheight: media.height > ctx.max_texsize ?
							ctx.max_texsize : media.height,
					});
			}
			else
				bitmap = await createImageBitmap(blob);

			if (ctx.gui.eruda)
				console.log("Bitmap creation [ms]:",
					(performance.now() - bit2_time).toFixed(2));

			media_setup(bitmap, media);
		} catch (err) {
			console.error(err);
		}
	else if (media.type == "video")
		try {
			load_video(media)
		} catch (err) {
			console.error(err);
		}
}

export function media_setup(bitmap, media) {
	ctx.dom.statusMSG.innerText = "Transfering into GPU memory";

	ctr.ch1.fov_deg = media.sphere_fov;
	ctr.cam.rot_deg[0] = media.camera_initial.Pitch;
	ctr.cam.rot_deg[1] = media.camera_initial.Yaw;
	ctr.ch1.rot_deg[0] = media.world_rotation.Pitch;
	ctr.ch1.rot_deg[1] = media.world_rotation.Yaw;
	ctr.ch1.rot_deg[2] = media.world_rotation.Roll;
	ctx.gui.controller.world_pitch.updateDisplay();
	ctx.gui.controller.world_yaw.updateDisplay();
	ctx.gui.controller.world_roll.updateDisplay();
	ctx.gui.controller.cam_pitch.updateDisplay();
	ctx.gui.controller.cam_yaw.updateDisplay();
	ctx.gui.controller.img_fov.updateDisplay();

	ctx.gui.controller.left.setValue(media.crop.left);
	ctx.gui.controller.right.setValue(media.crop.right);
	ctx.gui.controller.top.setValue(media.crop.top);
	ctx.gui.controller.bot.setValue(media.crop.bot);

	if (media.ch2 && typeof media.ch2 != "boolean") {
		ctr.ch2.fov_deg = media.ch2.sphere_fov;
		ctr.ch2.rot_deg[0] = media.ch2.world_rotation.Pitch;
		ctr.ch2.rot_deg[1] = media.ch2.world_rotation.Yaw;
		ctr.ch2.rot_deg[2] = media.ch2.world_rotation.Roll;

		ctx.gui.controller.left_ch2.setValue(media.ch2.crop.left);
		ctx.gui.controller.right_ch2.setValue(media.ch2.crop.right);
		ctx.gui.controller.top_ch2.setValue(media.ch2.crop.top);
		ctx.gui.controller.bot_ch2.setValue(media.ch2.crop.bot);

		ctx.gui.controller.world_pitch_ch2.updateDisplay();
		ctx.gui.controller.world_yaw_ch2.updateDisplay();
		ctx.gui.controller.world_roll_ch2.updateDisplay();
	}
	/* In case resize was performed due to GPU not supporting that size */
	if (media.width != bitmap.width || media.height != bitmap.height) {
		if (media.width && media.height) {
			ctx.gui.controller.left.setValue(
				media.crop.left * bitmap.width / media.width);
			ctx.gui.controller.right.setValue(
				media.crop.right * bitmap.width / media.width);
			ctx.gui.controller.top.setValue(
				media.crop.top * bitmap.height / media.height);
			ctx.gui.controller.bot.setValue(
				media.crop.bot * bitmap.height / media.height);
			if (media.ch2) {
				ctx.gui.controller.left_ch2.setValue(
					media.ch2.crop.left * bitmap.width / media.width);
				ctx.gui.controller.right_ch2.setValue(
					media.ch2.crop.right * bitmap.width / media.width);
				ctx.gui.controller.top_ch2.setValue(
					media.ch2.crop.top * bitmap.height / media.height);
				ctx.gui.controller.bot_ch2.setValue(
					media.ch2.crop.bot * bitmap.height / media.height);
			}
		}
	}

	if (ctx.gui.eruda) var tex_time = performance.now()
	ctx.gl.deleteTexture(ctx.shaders.ch1.tex);
	ctx.shaders.ch1.tex = ctx.gl.createTexture();
	ctx.gl.bindTexture(ctx.gl.TEXTURE_2D, ctx.shaders.ch1.tex);
	ctx.gl.texParameteri(
		ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_WRAP_S, ctx.gl.CLAMP_TO_EDGE);
	ctx.gl.texParameteri(
		ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_WRAP_T, ctx.gl.CLAMP_TO_EDGE);
	ctx.gl.texParameteri(
		ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_MIN_FILTER, ctx.gl.LINEAR);
	ctx.gl.texParameteri(
		ctx.gl.TEXTURE_2D, ctx.gl.TEXTURE_MAG_FILTER, ctx.gl.LINEAR);

	ctx.shaders.ch1.w = bitmap.width;
	ctx.shaders.ch1.h = bitmap.height;
	recalc_croplimits();

	ctx.gl.texImage2D(ctx.gl.TEXTURE_2D, 0, ctx.gl.RGB, ctx.gl.RGB,
		ctx.gl.UNSIGNED_BYTE, bitmap);
	if (ctx.gui.eruda)
		console.log("Texture creation [ms]:",
			(performance.now() - tex_time).toFixed(2));
	bitmap.close();
	ctx.gui.handle.show();
	ctx.dom.spinner.style.display = 'none';
	ctx.dom.statusMSG.innerText = "\u00A0";
	ctx.dom.filesize.innerText = "\u00A0";
	ctx.loading = false;

	/* Have to call a redraw here, since this function is called async */
	ctx.redraw = true;
	redraw();
}

/* Just update the texture without recreating it. Could implement an async GPU
   transfer, but that would break WebGL 1.0 compatibility. I plan to move to
   threeJS for VR support, so this is fine for now. */
export function update_texture(bitmap) {
	if (ctx.shaders.ch1.w != bitmap.width ||
		ctx.shaders.ch1.h != bitmap.height) {
		console.error("Bitmap and texture size mismatch");
		return;
	};
	if (ctx.gui.eruda) var vram_time = performance.now()
	ctx.gl.texSubImage2D(ctx.gl.TEXTURE_2D, 0, 0, 0,
		ctx.gl.RGB, ctx.gl.UNSIGNED_BYTE, bitmap);
	if (ctx.gui.eruda)
		console.log("Texture update [ms]:",
			(performance.now() - vram_time).toFixed(2));
	bitmap.close();
}

/* Defined twice and three times if we count the toggle menu button,
   need to clean this up. */
export function closeMenu() {
	const menu = document.getElementById('menu');
	menu.style.display = 'none';
}