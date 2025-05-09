import { globSync } from "glob";
import { flatten, uniqBy } from "lodash-es";
import { Hex, Abi } from "viem";
import { toFunctionSignature } from "viem/utils";
import { AbiConstructor, AbiError, AbiEvent, AbiFallback, AbiFunction, AbiReceive, formatAbiItem } from "abitype";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "node:crypto";
import { join } from "path";
import path from "node:path";
import { generateBarrelFileForDir } from "./generateBarrelFile.js";

export interface Artifact {
    _format: string;
    contractName?: string;
    sourceName: string;
    abi: Abi;
    bytecode: Hex | { object: Hex };
    deployedBytecode: Hex | { object: Hex };
    linkReferences: Record<string, any>;
    deployedLinkReferences: Record<string, any>;
}

/**
 * Export events, functions, errors
 * Export individual
 */

/**
 * Abi exports
 */
export type AbiExports = {
    abi: string[];
    functions: string[];
    events: string[];
    errors: string[];
} & Record<string, AbiConstructor | AbiError | AbiEvent | AbiFallback | AbiFunction | AbiReceive>;

/**
 * Parse abi to unique exports
 * - individual functions, events, errors
 * - all functions, events, errors
 * - full abi
 * @param abi
 * @returns abi exports
 */
export function getAbiExports(abi: Abi): AbiExports {
    // TODO: Reserved keywords (eg. abi, bytecode etc...)

    const names: Record<string, string> = {};
    const signatures: Record<string, boolean> = {};

    const abiExports = {
        abi: [],
        functions: [],
        events: [],
        errors: [],
    } as unknown as AbiExports;

    abi.forEach((f) => {
        if (f.type === "constructor") {
            // Default reserved functions
            abiExports.abi.push("_constructor");
            abiExports.functions.push("_constructor");
            // constructor is reserved keyword in js, use _constructor instead
            abiExports._constructor = f;
        } else if (f.type === "fallback" || f.type === "receive") {
            // Default reserved functions
            abiExports.abi.push(f.type);
            abiExports.functions.push(f.type);
            abiExports[f.type] = f;
        } else {
            const abiFormatted = formatAbiItem(f);
            const signature = toFunctionSignature(abiFormatted);
            // skip
            if (signatures[signature]) return;
            signatures[signature] = true;
            // remove return statement
            let signatureClean = signature;
            signatureClean = signature
                .replaceAll("(", "_")
                .replaceAll(")", "_")
                .replaceAll(",", "_")
                .replaceAll("[]", "array");
            // Remove trailing _ from closing )
            signatureClean = signatureClean.substring(0, signatureClean.length - 1);

            // Export array
            let exportsArray: string[];
            if (f.type === "function") exportsArray = abiExports.functions;
            else if (f.type === "event") exportsArray = abiExports.events;
            else if (f.type === "error") exportsArray = abiExports.errors;
            else throw new Error("Invalid abi type");

            if (!names[f.name]) {
                // Export friendly name
                names[f.name] = signatureClean;
                abiExports.abi.push(f.name);
                exportsArray.push(f.name);
                abiExports[f.name] = f;
            } else {
                // TODO: Also export original signature
                // Duplicate name, export signature
                abiExports.abi.push(signatureClean);
                exportsArray.push(signatureClean);
                abiExports[signatureClean] = f;
            }
        }
    });

    return abiExports;
}

export function getAbiExportsString(abiExports: AbiExports): string {
    let abiExportsString = "";
    Object.entries(abiExports).forEach(([key, value]) => {
        if (key != "abi" && key != "functions" && key != "events" && key != "errors") {
            abiExportsString = `${abiExportsString}export const ${key} = ${JSON.stringify(value)} as const;\n`;
        }
    });

    abiExportsString = `${abiExportsString}export const functions = [${abiExports.functions.join(",")}] as const;
export const events = [${abiExports.events.join(",")}] as const;
export const errors = [${abiExports.errors.join(",")}] as const;
export const abi = [...functions, ...events, ...errors] as const;
`;

    return abiExportsString;
}

/**
 * Takes an artifact and generates proper export file content.
 *   - Inidvidual keys are exported for better tree-shaking
 * @param artifact contains abi, bytecode, deployedBytecode
 */
export function getArtifactExportFileContent(artifact: Artifact): string {
    const abiExportsString = getAbiExportsString(getAbiExports(artifact.abi));
    const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode.object;
    const deployedBytecode =
        typeof artifact.deployedBytecode === "string" ? artifact.deployedBytecode : artifact.deployedBytecode.object;

    if (bytecode != "0x") {
        return `import { Hex } from "viem";

${abiExportsString}
export const bytecode = "${bytecode}" as Hex;
export const deployedBytecode = "${deployedBytecode}" as Hex;
export const ${artifact.contractName} = {
    abi,
    bytecode,
    deployedBytecode,
};
`;
    } else {
        return `
${abiExportsString}
export const ${artifact.contractName} = {
    abi,
};
`;
    }
}

export const DEFAULT_ARTIFACTS_DIR = "./src/artifacts";
export const DEFAULT_CACHE_DIR = "./cache";
export const DEFAULT_ARTIFACTS_GLOB = "artifacts/contracts/**/*.json";

export function hardhatArtifactsExport(
    artifactDir = DEFAULT_ARTIFACTS_DIR,
    cacheDir = DEFAULT_CACHE_DIR,
    hardhatArtifactsGlob: string | string[] = DEFAULT_ARTIFACTS_GLOB,
) {
    if (!existsSync(artifactDir)) {
        mkdirSync(artifactDir);
    }

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir);
    }

    // Get files paths for artifacts, this includes libraries
    const artifactPaths = globSync(hardhatArtifactsGlob).filter((f) => !f.endsWith(".dbg.json"));
    // console.debug(artifactPaths);

    // Filter contract/interface artifacts.
    // To do so we load the abi, and check if any `type: function | fallback`
    // exists since libraries cannot have those
    const contractArtifacts = artifactPaths
        .map((artifactPath) => {
            const artifact = JSON.parse(readFileSync(artifactPath, "utf-8")) as Artifact & { contractName: string };
            if (!artifact.contractName) {
                artifact.contractName = path.basename(artifactPath).replace(".json", "");
            }

            return artifact;
        })
        .filter((artifact) => {
            const abi = artifact.abi;
            const abiFunctions = abi.filter((a) => a.type === "function" || a.type === "fallback");
            return abiFunctions.length > 0;
        });

    // Load exports cache last hash
    const artifactExportsCachePath = join(cacheDir, "artifact-exports-cache.json");
    let artifactExportsCache: Record<string, string> = {};
    if (existsSync(artifactExportsCachePath)) {
        artifactExportsCache = JSON.parse(readFileSync(artifactExportsCachePath, "utf-8"));
    }

    // Filter artifacts that don't match cached hash
    const contractArtifactsChanged = contractArtifacts.filter((artifact) => {
        const artifactHash = createHash("md5").update(JSON.stringify(artifact)).digest("hex");
        return artifactExportsCache[artifact.contractName] != artifactHash;
    });

    // For each artifact, write to .ts file
    contractArtifactsChanged.forEach((artifact) => {
        const contractName = artifact.contractName;
        // update cache
        artifactExportsCache[contractName] = createHash("md5").update(JSON.stringify(artifact)).digest("hex");

        // write to `src/artifacts/{artifact.contractName}.ts`
        const artifactData = getArtifactExportFileContent(artifact);
        writeFileSync(join(artifactDir, `${contractName}.ts`), artifactData);
    });

    // Check if all contracts cached
    const allCached = contractArtifactsChanged.length === 0;

    if (!allCached) {
        // All functions
        const functions = uniqBy(
            flatten(contractArtifacts.map((artifact) => artifact.abi.filter((item) => item.type === "function"))),
            (f) => toFunctionSignature(formatAbiItem(f)),
        );
        writeFileSync(
            join(artifactDir, "functions.ts"),
            `export const functions = [${functions.map((f) => JSON.stringify(f)).join(",")}] as const;`,
        );

        // All events
        const events = uniqBy(
            flatten(contractArtifacts.map((artifact) => artifact.abi.filter((item) => item.type === "event"))),
            (f) => `${toFunctionSignature(formatAbiItem(f))}-${f.inputs.filter((input) => input.indexed).length}`,
        );
        writeFileSync(
            join(artifactDir, "events.ts"),
            `export const events = [${events.map((f) => JSON.stringify(f)).join(",")}] as const;`,
        );
        // All errors
        const errors = uniqBy(
            flatten(contractArtifacts.map((artifact) => artifact.abi.filter((item) => item.type === "error"))),
            (f) => toFunctionSignature(formatAbiItem(f)),
        );
        writeFileSync(
            join(artifactDir, "errors.ts"),
            `export const errors = [${errors.map((f) => JSON.stringify(f)).join(",")}] as const;`,
        );
    }

    generateBarrelFileForDir(artifactDir, "namedModule");

    // save cache
    writeFileSync(artifactExportsCachePath, JSON.stringify(artifactExportsCache));

    if (contractArtifactsChanged.length > 0) {
        console.debug(
            `Exported ${contractArtifactsChanged.length} Artifact file${contractArtifactsChanged.length > 1 ? "s" : ""} successfully`,
        );
    } else {
        console.debug("Nothing to export");
    }
}
