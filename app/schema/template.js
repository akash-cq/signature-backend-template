import zod from 'zod';

export const templateCretionSchema = zod.object({
    'url': zod.string(),
    'templateName': zod.string(),
    'description': zod.string(),
});
