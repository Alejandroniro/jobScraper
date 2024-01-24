import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ScrapingController } from './scraping/scraping.controller';
import { ScrapingModule } from './scraping/scraping.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_CONNECT_URI),
    ScrapingModule,
    ScheduleModule.forRoot()
  ],
  controllers: [AppController, ScrapingController],
  providers: [AppService],
})
export class AppModule {}
