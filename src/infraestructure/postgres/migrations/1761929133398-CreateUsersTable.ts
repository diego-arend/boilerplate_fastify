import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1761929133398 implements MigrationInterface {
    name = 'CreateUsersTable1761929133398'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(128) NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "lastLoginAt" TIMESTAMP, "loginAttempts" integer NOT NULL DEFAULT '0', "lockUntil" TIMESTAMP, "emailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying(255), "passwordResetToken" character varying(255), "passwordResetExpires" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_204e9b624861ff4a5b26819210" ON "users" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6ee2d4bf901675877bb94977c" ON "users" ("status", "role") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6ee2d4bf901675877bb94977c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_204e9b624861ff4a5b26819210"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    }

}
