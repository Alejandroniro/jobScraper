import { Controller, Get, Query } from "@nestjs/common";
import { ScrapingService } from "./scraping.service";

@Controller('scraping')
export class ScrapingController {
    constructor(private readonly scrapingService: ScrapingService) { }

    @Get('/scrape-all')
    async scrapeAll() {
        try {
            const computrabajoDetails = await this.scrapingService.scrapeComputrabajo();
            const getManfredDetails = await this.scrapingService.scrapeGetManfred();

            return {
                success: true,
                data: {
                    computrabajo: computrabajoDetails,
                    getManfred: getManfredDetails,
                },
            };
        } catch (error) {
            console.error('Error during scraping:', error);
            return { success: false, error: 'An error occurred during scraping.' };
        }
    }
    @Get('/find-by-title')
    async findByTitle() {
        try {
            const result = await this.scrapingService.findByTitle();
            const titles = result.map(job => job.title);

            return { success: true, data: titles };
        } catch (error) {
            console.error('Error during find by title:', error);
            return { success: false, error: 'An error occurred during find by title.' };
        }
    }

    @Get('/find-by-company')
    async findByCompany() {
        try {
            const result = await this.scrapingService.findByCompany();
            const companies = result.map(job => job.company);

            return { success: true, data: companies };
        } catch (error) {
            console.error('Error during find by company:', error);
            return { success: false, error: 'An error occurred during find by company.' };
        }
    }

    @Get('/find-by-location')
    async findByLocation() {
        try {
            const result = await this.scrapingService.findByLocation();
            const locations = result.map(job => job.location);

            return { success: true, data: locations };
        } catch (error) {
            console.error('Error during find by location:', error);
            return { success: false, error: 'An error occurred during find by location.' };
        }
    }

    @Get('/find-by-salary')
    async findBySalary() {
        try {
            const result = await this.scrapingService.findBySalary();
            const salaries = result.map(job => job.salary);

            return { success: true, data: salaries };
        } catch (error) {
            console.error('Error during find by salary:', error);
            return { success: false, error: 'An error occurred during find by salary.' };
        }
    }

    @Get('/find-by-keyword')
    async findByKeyword() {
        try {
            const result = await this.scrapingService.findByKeyword();
            const keywords = result.map(job => job.keyword);

            return { success: true, data: keywords };
        } catch (error) {
            console.error('Error during find by keyword:', error);
            return { success: false, error: 'An error occurred during find by keyword.' };
        }
    }

    @Get('/get-all-jobs')
    async getAllJobs() {
        try {
            const result = await this.scrapingService.getAllJobs();
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting all jobs:', error);
            return { success: false, error: 'An error occurred while getting all jobs.' };
        }
    }

    @Get('/find-by-requirement')
    async findByRequirement() {
        try {
            const result = await this.scrapingService.findByRequirement();
            const requirements = result.map(job => job.requirement);

            return { success: true, data: requirements };
        } catch (error) {
            console.error('Error during find by requirement:', error);
            return { success: false, error: 'An error occurred during find by requirement.' };
        }
    }

    @Get('/find-education')
    async findEducation() {
        try {
            const result = await this.scrapingService.findEducation();
            const educationInfo = result.map(job => job.requirement.education);

            return { success: true, data: educationInfo };
        } catch (error) {
            console.error('Error during find education:', error);
            return { success: false, error: 'An error occurred during find education.' };
        }
    }

    @Get('/find-experience')
    async findExperience() {
        try {
            const result = await this.scrapingService.findExperience();
            const experienceInfo = result.map(job => job.requirement.experience);

            return { success: true, data: experienceInfo };
        } catch (error) {
            console.error('Error during find experience:', error);
            return { success: false, error: 'An error occurred during find experience.' };
        }
    }

    @Get('/find-language')
    async findLanguage() {
        try {
            const result = await this.scrapingService.findLanguage();
            const languageInfo = result.map(job => job.requirement.languages);

            return { success: true, data: languageInfo };
        } catch (error) {
            console.error('Error during find language:', error);
            return { success: false, error: 'An error occurred during find language.' };
        }
    }

    @Get('/find-skill')
    async findSkill() {
        try {
            const result = await this.scrapingService.findSkill();
            const skillInfo = result.map(job => job.requirement.skills);

            return { success: true, data: skillInfo };
        } catch (error) {
            console.error('Error during find skill:', error);
            return { success: false, error: 'An error occurred during find skill.' };
        }
    }
}