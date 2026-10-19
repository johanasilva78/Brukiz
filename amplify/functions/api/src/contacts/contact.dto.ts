import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const CONTACT_TYPES = ["prospecto", "cliente", "asegurado", "beneficiario", "representante"] as const;
export const CONTACT_STATUSES = ["activo", "seguimiento", "nuevo", "inactivo"] as const;

export class CreateContactDto {
  @ApiProperty({ example: "María Fernanda López" })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: "maria@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+504 9988-1204" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ enum: CONTACT_TYPES })
  @IsIn(CONTACT_TYPES)
  type!: (typeof CONTACT_TYPES)[number];

  @ApiPropertyOptional({ example: "Empresa de ejemplo" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  company?: string;
}

export class UpdateContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ enum: CONTACT_TYPES })
  @IsOptional()
  @IsIn(CONTACT_TYPES)
  type?: (typeof CONTACT_TYPES)[number];

  @ApiPropertyOptional({ enum: CONTACT_STATUSES })
  @IsOptional()
  @IsIn(CONTACT_STATUSES)
  status?: (typeof CONTACT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  company?: string;
}
