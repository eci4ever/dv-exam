CREATE TABLE `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `emailVerified` integer NOT NULL,
  `image` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `token` text NOT NULL UNIQUE,
  `expiresAt` integer NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `issuer` text NOT NULL,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `accessTokenExpiresAt` integer,
  `refreshTokenExpiresAt` integer,
  `scope` text,
  `idToken` text,
  `password` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  UNIQUE(`issuer`, `accountId`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` integer NOT NULL,
  `createdAt` integer,
  `updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);
