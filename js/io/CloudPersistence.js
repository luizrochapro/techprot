import { ConvexClient } from 'https://esm.sh/convex@1.45.0/browser';

const client = new ConvexClient(window.TECHPROT_CONVEX_URL ?? 'http://127.0.0.1:3210');

export async function listNetworks() {
    try {
        return await client.query('networks:list', {});
    } catch (e) {
        throw new Error(e?.message ?? String(e));
    }
}

export async function getNetwork(id) {
    try {
        return await client.query('networks:get', { id });
    } catch (e) {
        throw new Error(e?.message ?? String(e));
    }
}

export async function saveNetwork({ id, name, xml }) {
    try {
        const args = { name, xml };
        if (id !== undefined && id !== null) args.id = id;
        const result = await client.mutation('networks:upsert', args);
        return typeof result === 'string' ? result : (result?._id ?? result?.id ?? result);
    } catch (e) {
        throw new Error(e?.message ?? String(e));
    }
}

export async function deleteNetwork(id) {
    try {
        return await client.mutation('networks:remove', { id });
    } catch (e) {
        throw new Error(e?.message ?? String(e));
    }
}

export const CloudPersistence = {
    listNetworks,
    getNetwork,
    saveNetwork,
    deleteNetwork
};
