import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ScrapingController } from './scraping/scraping.controller';
import { ScrapingModule } from './scraping/scraping.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost/jobScraper'),
    ScrapingModule,
  ],
  controllers: [AppController, ScrapingController],
  providers: [AppService],
})
export class AppModule {}
