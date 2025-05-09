import {
    Account,
    Address,
    Chain,
    Client,
    Hash,
    Hex,
    TransactionRequest,
    Transport,
    concat,
    encodeAbiParameters,
    isHex,
} from "viem";
import { getAction } from "viem/utils";
import { getCode, prepareTransactionRequest, sendTransaction } from "viem/actions";
import { DETERMINISTIC_DEPLOYER_ADDRESS } from "./constants.js";
import { getDeployDeterministicAddress } from "./getAddress.js";

/**
 * Encode deploy deterministic fallback data
 * @param salt
 * @param bytecode
 * @returns
 */
export function getDeployDeterministicFunctionData({ salt, bytecode }: { salt: Hash; bytecode: Hex }): {
    to: Address;
    data: Hex;
} {
    const saltBytes32 = encodeAbiParameters([{ type: "bytes32" }], [salt]);
    if (!isHex(bytecode)) {
        throw new Error(`bytecode not hex: ${bytecode}`);
    }
    const data = concat([saltBytes32, bytecode]);

    return {
        to: DETERMINISTIC_DEPLOYER_ADDRESS,
        data,
    };
}

export interface GetOrPrepareDeterministicContractReturnType {
    address: Address;
    request: TransactionRequest | undefined;
    existed: boolean;
}
/**
 * Get or prepare contract deployment using DeterministicDeployer
 * @param client Client with chain & account
 * @param salt Hex
 * @param bytecode Hex
 * @returns deploy transaction hash
 */
export async function getOrPrepareDeterministicContract(
    client: Client<Transport, Chain, Account>,
    { salt, bytecode }: { salt: Hash; bytecode: Hex },
): Promise<GetOrPrepareDeterministicContractReturnType> {
    // Make sure DeterministicDeployer exists
    if ((await getAction(client, getCode, "getCode")({ address: DETERMINISTIC_DEPLOYER_ADDRESS })) === undefined) {
        throw new Error(
            `DeterministicDeployer not deployed at ${DETERMINISTIC_DEPLOYER_ADDRESS}! Please deploy DeterministicDeployer first or use pre-signed deployment.`,
        );
    }

    const address = getDeployDeterministicAddress({ salt, bytecode });
    // Check if contract exists
    const existingByteCode = await getAction(client, getCode, "getCode")({ address });
    if (existingByteCode != undefined) {
        return {
            address,
            request: undefined,
            existed: true,
        };
    }

    const { to, data } = getDeployDeterministicFunctionData({ salt, bytecode });
    const request = await getAction(
        client,
        prepareTransactionRequest,
        "prepareTransactionRequest",
    )({
        to,
        data,
        account: client.account,
        chain: client.chain,
        // Avoid computing nonce
        parameters: ["blobVersionedHashes", "chainId", "fees", "gas", "type"],
    });

    return {
        address,
        request,
        existed: false,
    };
}

export interface GetOrDeployDeterministicContractReturnType {
    address: Address;
    hash: Hash | undefined;
    existed: boolean;
}
/**
 * Get or deploy contract using DeterministicDeployer
 * @param client Client with chain & account
 * @param salt Hex
 * @param bytecode Hex
 * @returns deploy transaction hash
 */
export async function getOrDeployDeterministicContract(
    client: Client<Transport, Chain, Account>,
    { salt, bytecode }: { salt: Hash; bytecode: Hex },
): Promise<GetOrDeployDeterministicContractReturnType> {
    const { address, request, existed } = await getOrPrepareDeterministicContract(client, { salt, bytecode });

    let hash: Hash | undefined;
    if (request) {
        hash = await getAction(client, sendTransaction, "sendTransaction")(request as any);
    }

    return {
        address,
        hash,
        existed,
    };
}
