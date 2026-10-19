import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import { CreateContactDto, UpdateContactDto } from "./contact.dto";
import { ContactsService } from "./contacts.service";
import { tenantIdFromRequest } from "../tenant-context";

type AuthenticatedRequest = Request & {
  apiGateway?: {
    event?: {
      requestContext?: {
        authorizer?: {
          claims?: Record<string, string | undefined>;
        };
      };
    };
  };
};

function actorIdFromRequest(request: Request): string {
  const claims = (request as AuthenticatedRequest).apiGateway?.event?.requestContext?.authorizer?.claims;
  const actorId = claims?.sub;
  if (!actorId) {
    throw new ForbiddenException("La sesión no contiene un identificador de usuario válido.");
  }
  return actorId;
}

@ApiTags("Contactos")
@ApiBearerAuth()
@Controller("contacts")
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly contacts: ContactsService) {}

  @Get()
  @ApiOkResponse({ description: "Contactos de la agencia del usuario autenticado." })
  list(@Req() request: Request) {
    return this.contacts.list(tenantIdFromRequest(request));
  }

  @Post()
  @ApiCreatedResponse({ description: "Contacto creado y auditado." })
  create(@Req() request: Request, @Body() input: CreateContactDto) {
    return this.contacts.create(tenantIdFromRequest(request), actorIdFromRequest(request), input);
  }

  @Get(":id")
  @ApiOkResponse({ description: "Detalle de un contacto del tenant autenticado." })
  get(@Req() request: Request, @Param("id") id: string) {
    return this.contacts.get(tenantIdFromRequest(request), id);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "Contacto actualizado y auditado." })
  update(@Req() request: Request, @Param("id") id: string, @Body() input: UpdateContactDto) {
    return this.contacts.update(tenantIdFromRequest(request), actorIdFromRequest(request), id, input);
  }

  @Delete(":id")
  @ApiNoContentResponse({ description: "Contacto desactivado sin borrar su historial." })
  async deactivate(@Req() request: Request, @Param("id") id: string): Promise<void> {
    await this.contacts.deactivate(tenantIdFromRequest(request), actorIdFromRequest(request), id);
  }
}
