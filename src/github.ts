import { createHash } from "crypto";
import * as vscode from "vscode";

const GITHUB_API_URL = "https://api.github.com/repos/rockide/language-server/releases";

export type GitHubRelease = {
	tag_name: string;
	assets: GitHubAsset[];
};

export type GitHubAsset = {
	name: string;
	digest: string;
	browser_download_url: string;
};

export async function getLatestRelease() {
	const res = await fetch(`${GITHUB_API_URL}/latest`);
	if (!res.ok) {
		throw new Error(`Failed to fetch latest version: ${res.statusText} (${res.status})`);
	}
	return await res.json() as GitHubRelease;
}

export function downloadAsset(asset: GitHubAsset) {
	return vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Downloading ${asset.name}`,
			cancellable: true,
		},
		async (progress, token) => {
			const abortController = new AbortController();
			token.onCancellationRequested(() => {
				abortController.abort();
			});

			let res = await fetch(asset.browser_download_url, {
				signal: abortController.signal,
			});
			if (!res.ok) {
				throw new Error(`${res.statusText} (${res.status})`);
			}
			if (!res.body) {
				throw new Error("Failed to get response body.");
			}

			const contentLength = res.headers.get("Content-Length");
			const totalBytes = contentLength ? parseInt(contentLength) : 0;
			if (totalBytes === 0) {
				throw new Error("Failed to get response content length.");
			}

			let receivedLength = 0;
			const stream = new TransformStream<{ length: number }>({
				transform(chunk, controller) {
					receivedLength += chunk.length;
					const increment = (chunk.length / totalBytes) * 100;
					const currentProgress = (receivedLength / totalBytes) * 100;
					progress.report({
						message: `${currentProgress.toFixed()}%`,
						increment,
					});
					controller.enqueue(chunk);
				},
			});
			res = new Response(res.body.pipeThrough(stream));

			const data = Buffer.from(await res.arrayBuffer());
			const digest = createHash("sha256").update(data).digest("hex");
			if (`sha256:${digest}` !== asset.digest) {
				throw new Error("Checksum verification failed.");
			}

			return data;
		},
	);
}
