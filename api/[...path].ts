import handler from './_handler';

export default async function apiCatchAll(req: unknown, res: unknown) {
    return handler(req, res);
}
