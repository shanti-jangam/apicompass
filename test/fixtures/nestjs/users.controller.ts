import { Controller, Get, Post, Put, Delete, Patch, Body, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() _createUserDto: unknown) {
    return { id: 1 };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() _updateUserDto: unknown) {
    return { id };
  }

  @Delete(':id')
  remove(@Param('id') _id: string) {
    return;
  }

  @Patch(':id')
  patch(@Param('id') _id: string, @Body() _patchDto: unknown) {
    return { id };
  }
}
