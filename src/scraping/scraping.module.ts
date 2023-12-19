import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from './job.model'
import { ScrapingService } from './scraping.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Job', schema: JobSchema }]),
    ],
    providers: [ScrapingService],
    exports: [ScrapingService],
})

export class ScrapingModule {}