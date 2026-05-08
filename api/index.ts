import handler from './_handler';

export default async function apiIndex(req: unknown, res: unknown) {
    return handler(req, res);
}
