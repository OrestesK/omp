import { randomUUID } from "node:crypto";

import type { ImageContent } from "@oh-my-pi/pi-ai";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import {
	Container,
	Image,
	ImageProtocol,
	isImageProtocolForced,
	setTerminalImageProtocol,
	Spacer,
	Text,
} from "@oh-my-pi/pi-tui";

const CUSTOM_MESSAGE_TYPE = "sixel-submit-preview";
const PREVIEW_LABEL = "Pasted image preview";

// Keep the same bounds as the previous pi-sixel extension.
const MAX_COLUMNS = 120;
const MAX_ROWS = 36;
const MAX_IMAGES = 4;

interface PreviewTheme {
	fg(color: "muted", text: string): string;
}

interface PreviewDetails {
	id: string;
}

function previewDetails(value: unknown): PreviewDetails | undefined {
	if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
	return typeof value.id === "string" ? { id: value.id } : undefined;
}

function previewComponent(images: readonly ImageContent[], previewId: string, theme: PreviewTheme): Container {
	const container = new Container();
	container.addChild(new Text(theme.fg("muted", PREVIEW_LABEL), 0, 0));
	container.addChild(new Spacer(1));

	for (const [index, image] of images.entries()) {
		if (index > 0) container.addChild(new Spacer(1));
		container.addChild(
			new Image(
				image.data,
				image.mimeType,
				{ fallbackColor: text => theme.fg("muted", text) },
				{
					maxWidthCells: MAX_COLUMNS,
					maxHeightCells: MAX_ROWS,
					imageKey: `${CUSTOM_MESSAGE_TYPE}:${previewId}:${index}`,
				},
			),
		);
	}

	return container;
}

export default function sixelSubmitPreview(pi: ExtensionAPI): void {
	if (!isImageProtocolForced()) setTerminalImageProtocol(ImageProtocol.Sixel);
	let pendingImages: ImageContent[] = [];
	const previews = new Map<string, readonly ImageContent[]>();

	pi.registerMessageRenderer<PreviewDetails>(CUSTOM_MESSAGE_TYPE, (message, _options, theme) => {
		const details = previewDetails(message.details);
		if (!details) return undefined;
		const images = previews.get(details.id);
		return images ? previewComponent(images, details.id, theme) : undefined;
	});

	pi.on("input", event => {
		if (!event.images?.length) return;
		pendingImages.push(...event.images);
	});

	pi.on("before_agent_start", () => {
		if (pendingImages.length === 0) return undefined;

		const images = pendingImages.slice(0, MAX_IMAGES);
		pendingImages = [];
		const id = randomUUID();
		previews.set(id, images);

		return {
			message: {
				customType: CUSTOM_MESSAGE_TYPE,
				content: [{ type: "text", text: PREVIEW_LABEL }],
				display: true,
				details: { id },
			},
		};
	});

	const clear = () => {
		pendingImages = [];
		previews.clear();
	};
	pi.on("session_switch", clear);
	pi.on("session_shutdown", clear);
}
