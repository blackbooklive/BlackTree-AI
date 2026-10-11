import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { auth } from "../auth";

const userRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// PATCH /api/user/profile - update user profile (image URL)
userRouter.patch(
  "/profile",
  zValidator("json", z.object({ image: z.string().url().nullable() })),
  async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { image } = c.req.valid("json");

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { image },
    });

    return c.json({ data: { image: user.image } });
  }
);

export { userRouter };
