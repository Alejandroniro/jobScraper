import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Job, JobSchema } from './job.model'
import { ScrapingService } from './scraping.service';
import { ScrapingController } from './scraping.controller';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Job', schema: JobSchema }]),
        ScheduleModule.forRoot(), // Asegúrate de incluir esto
    ],
    providers: [ScrapingService],
    exports: [ScrapingService],
})

export class ScrapingModule {}