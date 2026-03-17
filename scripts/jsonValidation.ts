/**
 * This script fetches file definitions from the bridge-core editor-packages
 * repository and generates JSON validation configurations for VS Code.
 *
 * @see https://github.com/bridge-core/editor-packages
 */

import { readFile, writeFile } from "fs/promises";

const BRIDGE_CORE_URL =
	"https://raw.githubusercontent.com/rockide/editor-packages/refs/heads/rockide/dist/minecraftBedrock/fileDefinitions.json";

const PACK_PREFIXES = {
	behaviorPack: ["behavior_pack/", "*BP/", "BP_*/", "*bp/", "bp_*/"],
	resourcePack: ["resource_pack/", "*RP/", "RP_*/", "*rp/", "rp_*/"],
};

const EXCLUDED_IDS = ["textureSet"];

type FileDefinition = {
	id: string;
	detect: {
		packType: keyof typeof PACK_PREFIXES;
		scope?: Array<string> | string;
		matcher: Array<string> | string;
		fileExtensions?: string[];
	};
	schema?: string;
};

type JsonValidation = {
	fileMatch: Array<string> | string;
	url: string;
};

type Package = {
	contributes?: {
		jsonValidation?: JsonValidation[];
	};
};

function getFileSuffix(extensions: string[]) {
	const [first] = extensions;
	if (first === ".json") {
		return "{json,jsonc,json5}";
	}
	if (first === ".material") {
		return "material";
	}
	return undefined;
}

function getFileMatch(
	packType: keyof typeof PACK_PREFIXES,
	scope: string[] | string,
	suffix: string,
) {
	const scopeValue = typeof scope === "string" ? scope : scope[0];
	return PACK_PREFIXES[packType].map((prefix) => {
		if (scopeValue.endsWith("/")) {
			return `${prefix}${scopeValue}**/*.${suffix}`;
		}
		const filePath = scopeValue.split(".")[0];
		return `${prefix}${filePath}.${suffix}`;
	});
}

function getSchema(schemaPath: string) {
	const filePath = schemaPath.split("minecraftBedrock/schema/").pop();
	return filePath ? `./schemas/${filePath}` : undefined;
}

function customSchemas(): JsonValidation[] {
	return [
		// TextureSet
		{
			fileMatch: [
				"resource_pack/textures/**/*.texture_set.{json,jsonc,json5}",
				"*RP/textures/**/*.texture_set.{json,jsonc,json5}",
				"RP_*/textures/**/*.texture_set.{json,jsonc,json5}",
				"*rp/textures/**/*.texture_set.{json,jsonc,json5}",
				"rp_*/textures/**/*.texture_set.{json,jsonc,json5}",
			],
			url: "./schemas/textureSet/main.json",
		},
		// SkinPack
		{
			fileMatch: "skin_pack/skins.{json,jsonc,json5}",
			url: "./schemas/skins/main.json",
		},
	];
}

async function getDefinitions() {
	const response = await fetch(BRIDGE_CORE_URL);
	return (await response.json()) as FileDefinition[];
}

function createDefinition(definition: FileDefinition) {
	const { id, detect, schema } = definition;
	const { packType, scope, fileExtensions } = detect;

	// Skip invalid or excluded definitions
	if (!schema || EXCLUDED_IDS.includes(id) || !fileExtensions || !scope) {
		return undefined;
	}
	// Validate pack type
	if (packType !== "behaviorPack" && packType !== "resourcePack") {
		return undefined;
	}
	const suffix = getFileSuffix(fileExtensions);
	if (!suffix) {
		return undefined;
	}
	const fileMatch = getFileMatch(packType, scope, suffix);
	const url = getSchema(schema);
	if (!url) {
		console.warn(`Invalid schema path "${schema}" for file definition "${id}".`);
		return undefined;
	}
	return { fileMatch, url };
}

function sortValidations(validations: JsonValidation[]) {
	return validations.sort((a, b) => {
		const aMatch = a.fileMatch[0].toLowerCase();
		const bMatch = b.fileMatch[0].toLowerCase();
		return aMatch.localeCompare(bMatch);
	});
}

async function main() {
	const fileDefinitions = await getDefinitions();
	const validations: JsonValidation[] = [];
	for (const definition of fileDefinitions) {
		const validation = createDefinition(definition);
		if (validation) {
			validations.push(validation);
		}
	}
	validations.push(...customSchemas());
	const sortedValidations = sortValidations(validations);
	const pkg: Package = JSON.parse(await readFile("./package.json", "utf8"));
	pkg.contributes = pkg.contributes || {};
	pkg.contributes.jsonValidation = sortedValidations;
	await writeFile("./package.json", JSON.stringify(pkg, null, "\t"));
}

main();
