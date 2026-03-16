import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProcedureWithoutTracing,
} from "@/src/server/api/trpc";
import {
  updateUserPassword,
  verifyPassword,
} from "@/src/features/auth-credentials/lib/credentialsServerUtils";
import { TRPCError } from "@trpc/server";
import { isEmailVerifiedWithinCutoff } from "@/src/features/auth-credentials/lib/credentialsUtils";
import { passwordSchema } from "@/src/features/auth/lib/signupSchema";

export const credentialsRouter = createTRPCRouter({
  hasPassword: protectedProcedureWithoutTracing.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { password: true },
    });
    return { hasPassword: !!user?.password };
  }),
  changePassword: protectedProcedureWithoutTracing
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { password: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No password is set on this account. Please use your SSO provider to sign in.",
        });
      }

      const isValid = await verifyPassword(
        input.currentPassword,
        user.password,
      );
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect.",
        });
      }

      await updateUserPassword(ctx.session.user.id, input.newPassword);
    }),
  resetPassword: protectedProcedureWithoutTracing
    .input(
      z.object({
        password: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: {
          id: ctx.session.user.id,
        },
        select: {
          emailVerified: true,
        },
      });

      const emailVerificationStatus = isEmailVerifiedWithinCutoff(
        user?.emailVerified?.toISOString(),
      );

      if (!emailVerificationStatus.verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            emailVerificationStatus.reason === "not_verified"
              ? "Email not verified."
              : "Email verification expired.",
        });
      }

      await updateUserPassword(ctx.session.user.id, input.password);
    }),
});
