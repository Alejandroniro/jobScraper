import { Controller, Get, Post, Query } from "@nestjs/common";
import { ScrapingService } from "./scraping.service";
import { format } from 'date-fns';

@Controller('scraping')
export class ScrapingController {
    constructor(private readonly scrapingService: ScrapingService) { }

    @Post('/scrape-all')
    async scrapeAll() {
        try {
            const computrabajoDetails = await this.scrapingService.scrapeComputrabajo();
            // Upsert for computrabajo
            await this.scrapingService.upsertJob(computrabajoDetails);

            const getManfredDetails = await this.scrapingService.scrapeGetManfred();
            // Upsert for getManfred
            await this.scrapingService.upsertJob(getManfredDetails);

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

    @Get('jobs')
    async getCountInfo(key: string, extractor: (job: any) => any) {
        try {
            const result = await this.scrapingService[key]();
            const fieldInfo = result.map(extractor).filter(Boolean);

            const fieldCount = {};
            fieldInfo.forEach(field => {
                fieldCount[field] = (fieldCount[field] || 0) + 1;
            });

            const fieldInfoWithCount = Object.keys(fieldCount).map(field => ({
                [key]: field,
                amount: fieldCount[field],
            }));

            return { success: true, data: fieldInfoWithCount };
        } catch (error) {
            console.error(`Error during find ${key}:`, error);
            return { success: false, error: `An error occurred during find ${key}.` };
        }
    }

    @Get('/get-all-jobs')
    async getAllJob() {
        try {
            const result = await this.scrapingService.getAllJobs();
            const filteredJobs = result.filter(job => job.title || job.company || job.requirement); // Filtra los trabajos que tienen al menos uno de estos campos no nulos

            // Obtener la fecha y hora actual en formato DD/MM/AAAA HH:mm:ss
            const currentDateTime = format(new Date(), 'dd/MM/yyyy');

            // Obtener la cantidad total de registros
            const currentRecords = filteredJobs.length;

            // Obtener la cantidad total de títulos
            const professionals = filteredJobs.reduce((count, job) => {
                return count + (job.title ? 1 : 0);
            }, 0);
            return {
                success: true,
                currentDateTime,
                currentRecords,
                professionals,

                data:
                    filteredJobs
            };
        } catch (error) {
            console.error('Error during get all jobs:', error);
            return { success: false, error: 'An error occurred during get all jobs.' };
        }
    }

    @Get('/find-by-title')
    async findByTitle() {
        return this.getCountInfo('findByTitle', job => job.title)
    }

    @Get('/find-by-company')
    async findByCompany() {
        try {
            const result = await this.scrapingService.findByCompany();

            // Objeto para realizar el seguimiento de la cantidad de registros por compañía
            const companyCount = {};

            // Itera sobre los trabajos y cuenta la cantidad de registros por compañía
            result.forEach(job => {
                const company = job.company;

                // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra esta compañía
                companyCount[company] = (companyCount[company] || 0) + 1;
            });

            // Convierte el objeto en un array de objetos
            const companyInfo = Object.keys(companyCount).map(company => ({
                company: company,
                amount: companyCount[company]
            }));

            // Obtiene el total de compañías
            const totalCompanies = Object.keys(companyCount).length;

            return {
                success: true,
                totalCompanies,
                data: {
                    companyInfo,
                }
            };
        } catch (error) {
            console.error('Error during find by company:', error);
            return { success: false, error: 'An error occurred during find by company.' };
        }

    }

    @Get('/find-by-location')
    async findByLocation() {
        return this.getCountInfo('findByLocation', job => job.location)

    }

    @Get('/find-by-salary')
    async findBySalary() {
        return this.getCountInfo('findBySalary', job => job.salary)

    }

    @Get('/find-by-keyword')
    async findByKeyword() {
        try {
            const result = await this.scrapingService.findByKeyword();

            // Objeto para realizar el seguimiento de las palabras clave y sus cantidades
            const keywordCount = {};

            // Itera sobre los trabajos y cuenta las palabras clave
            result.forEach(job => {
                const keywords = job.keyword || [];

                // Itera sobre las palabras clave y cuenta cada una
                keywords.forEach(keyword => {
                    // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra esta palabra clave
                    keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
                });
            });

            // Convierte el objeto en un array de objetos
            const keywordInfo = Object.keys(keywordCount).map(keyword => ({
                keyword: keyword,
                cantidad: keywordCount[keyword]
            }));

            return { success: true, data: keywordInfo };
        } catch (error) {
            console.error('Error during find by keyword:', error);
            return { success: false, error: 'An error occurred during find by keyword.' };
        }

    }

    @Get('/find-by-requirement')
    async findByRequirement() {
        return this.getCountInfo('findByRequirement', job => job.requirement)

    }

    @Get('/find-education')
    async findEducation() {
        return this.getCountInfo('findEducation', job => job.education)

    }

    @Get('/find-experience')
    async findExperience() {
        return this.getCountInfo('findExperience', job => job.experience)

    }

    @Get('/find-language')
    async findLanguage() {
        return this.getCountInfo('findLanguage', job => job.language)

    }

    @Get('/find-skill')
    async findSkill() {
        try {
            const result = await this.scrapingService.findSkill();

            // Objeto para realizar el seguimiento de las habilidades y sus cantidades
            const skillCount = {};

            // Itera sobre los trabajos y cuenta las habilidades
            result.forEach(job => {
                const skills = job.requirement.skills || [];

                // Itera sobre las habilidades y cuenta cada una
                skills.forEach(skill => {
                    // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra esta habilidad
                    skillCount[skill] = (skillCount[skill] || 0) + 1;
                });
            });

            // Convierte el objeto en un array de objetos
            const skillInfo = Object.keys(skillCount).map(skill => ({
                skill: skill,
                cantidad: skillCount[skill]
            }));

            return { success: true, data: skillInfo };
        } catch (error) {
            console.error('Error during find skill:', error);
            return { success: false, error: 'An error occurred during find skill.' };
        }

    }
}