import { Controller, Get, Post, Query } from "@nestjs/common";
import { ScrapingService } from "./scraping.service";
import { format } from 'date-fns';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('scraping') // Etiqueta para agrupar endpoints en Swagger
@Controller('scraping')
export class ScrapingController {
    constructor(private readonly scrapingService: ScrapingService) { }

    @ApiResponse({ status: 200, description: 'Operación exitosa' })
    @ApiResponse({ status: 400, description: 'Solicitud incorrecta' })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })
    @Post('/scrape-all')
    async scrapeAll() {
        try {
            const getManfredDetails = await this.scrapingService.scrapeGetManfred();
            // Upsert for getManfred
            await this.scrapingService.upsertJob(getManfredDetails);

            const computrabajoDetails = await this.scrapingService.scrapeComputrabajo();
            // Upsert for computrabajo

            await this.scrapingService.upsertJob(computrabajoDetails);
            return {
                success: true,
                data: {
                    getManfred: getManfredDetails,
                    computrabajo: computrabajoDetails,
                },
            };
        } catch (error) {
            console.error('Error during scraping:', error);
            return { success: false, error: 'An error occurred during scraping.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })
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
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-by-title')
    async findByTitle() {
        try {
            const result = await this.scrapingService.findByTitle();
            const titles = result.map(job => job.title).filter(Boolean);

            return { success: true, data: titles };
        } catch (error) {
            console.error('Error during find by title:', error);
            return { success: false, error: 'An error occurred during find by title.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

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
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-by-location')
    async findByLocation() {
        try {
            const result = await this.scrapingService.findByLocation();

            // Objeto para realizar el seguimiento de las ciudades y sus cantidades
            const cityCount = {};

            const locations = result.map(job => {
                if (!job.location) {
                    return null; // O manejar de alguna manera el caso en el que job.location sea null
                }

                const commaIndex = job.location.indexOf(',');
                const city = commaIndex !== -1 ? job.location.substring(0, commaIndex).trim() : job.location.trim();

                // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra esta ciudad
                cityCount[city] = (cityCount[city] || 0) + 1;

                return { city, amount: 1 };
            }).filter(location => location !== null);

            // Convierte el objeto en un array de objetos
            const locationsWithCount = Object.keys(cityCount).map(city => ({
                city,
                amount: cityCount[city]
            }));

            return { success: true, data: locationsWithCount };
        } catch (error) {
            console.error('Error during find by location:', error);
            return { success: false, error: 'An error occurred during find by location.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-by-salary')
    async findBySalary() {
        try {
            const result = await this.scrapingService.findBySalary();

            // Objeto para realizar el seguimiento de los salarios y sus cantidades
            const salaryCount: Record<string, number> = {};

            // Itera sobre los trabajos y cuenta los salarios
            result.forEach(job => {
                const salary = job.salary;

                // Verifica si el salario no es nulo antes de realizar operaciones
                if (salary !== null && salary !== undefined) {
                    // Elimina "(mensual)" y cualquier otro texto no deseado
                    const cleanedSalary = salary.replace(/\(mensual\)/i, '').trim();

                    // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra este salario
                    salaryCount[cleanedSalary] = (salaryCount[cleanedSalary] || 0) + 1;
                }
            });

            // Convierte el objeto en un array de objetos
            const salaryInfo = Object.keys(salaryCount).map(salary => ({
                salary: salary,
                cantidad: salaryCount[salary]
            }));

            return { success: true, data: salaryInfo };
        } catch (error) {
            console.error('Error during find by salary:', error);
            return { success: false, error: 'An error occurred during find by salary.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

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
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-by-requirement')
    async findByRequirement() {
        try {
            const result = await this.scrapingService.findByRequirement();

            // Devuelve el objeto completo
            return { success: true, data: result };
        } catch (error) {
            console.error('Error during find by requirement:', error);
            return { success: false, error: 'An error occurred during find by requirement.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-education')
    async findEducation() {
        try {
            const result = await this.scrapingService.findEducation();

            // Objeto para realizar el seguimiento de las educaciones y sus cantidades
            const educationCount = {};

            const educations = result.map(job => {
                if (!job.requirement || !job.requirement.education) {
                    return null; // O manejar de alguna manera el caso en el que education sea null
                }

                const education = job.requirement.education;

                // Incrementa la cantidad o inicializa en 1 si es la primera vez que se encuentra esta educación
                educationCount[education] = (educationCount[education] || 0) + 1;

                return { education, amount: 1 };
            }).filter(education => education !== null);

            // Convierte el objeto en un array de objetos
            const educationsWithCount = Object.keys(educationCount).map(education => ({
                education,
                amount: educationCount[education]
            }));

            return { success: true, data: educationsWithCount };
        } catch (error) {
            console.error('Error during find education:', error);
            return { success: false, error: 'An error occurred during find education.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-experience')
    async findExperience() {
        try {
            const result = await this.scrapingService.findExperience();

            // Objeto para realizar el seguimiento de las experiencias y sus cantidades
            const experienceCount = { junior: 0, semisenior: 0, senior: 0 };

            // Itera sobre los trabajos y cuenta las experiencias
            result.forEach(job => {
                const requirements = job.requirement || {};
                const experience = requirements.experience;

                // Función auxiliar para asignar la categoría de experiencia
                const assignExperienceCategory = () => {
                    if (!experience || experience.toLowerCase() === 'sin experiencia') {
                        return 'junior'; // Si no hay experiencia o es "sin experiencia", asume junior
                    } else {
                        const yearsOfExperience = parseInt(experience);

                        if (yearsOfExperience >= 1 && yearsOfExperience <= 2) {
                            return 'junior';
                        } else if (yearsOfExperience >= 3 && yearsOfExperience <= 4) {
                            return 'semisenior';
                        } else {
                            return 'senior';
                        }
                    }
                };

                // Asigna la categoría y actualiza la cantidad
                const category = assignExperienceCategory();
                experienceCount[category] = (experienceCount[category] || 0) + 1; // Actualiza la cantidad a 1 en lugar de job.amount
            });

            // Convierte el objeto en un array de objetos
            const experienceInfo = Object.keys(experienceCount).map(experience => ({
                role: experience,
                cantidad: experienceCount[experience]
            }));

            return { success: true, data: experienceInfo };
        } catch (error) {
            console.error('Error during find experience:', error);
            return { success: false, error: 'An error occurred during find experience.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Get('/find-language')
    async findLanguage() {
        try {
            const result = await this.scrapingService.findLanguage();

            // Objeto para realizar el seguimiento de los idiomas y sus cantidades
            const languageCount = {};

            const languages = result.map(job => {
                if (!job.requirement || !job.requirement.languages) {
                    return null; // O manejar de alguna manera el caso en el que language sea null o undefined
                }

                let jobLanguages;

                if (Array.isArray(job.requirement.languages)) {
                    // Si es un array, simplemente úsalo
                    jobLanguages = job.requirement.languages;
                } else {
                    // Si es una cadena, conviértela en un array con un solo elemento
                    jobLanguages = [job.requirement.languages];
                }

                // Itera sobre los idiomas y los agrega al contador
                jobLanguages.forEach(language => {
                    languageCount[language] = (languageCount[language] || 0) + 1;
                });

                return { languages: jobLanguages, amount: jobLanguages.length };
            }).filter(language => language !== null);

            // Convierte el objeto en un array de objetos
            const languagesWithCount = Object.keys(languageCount).map(language => ({
                language,
                amount: languageCount[language]
            }));

            return { success: true, data: languagesWithCount };
        } catch (error) {
            console.error('Error during find language:', error);
            return { success: false, error: 'An error occurred during find language.' };
        }
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

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
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Post('/start-scheduled-task')
    startScheduledTask() {
        this.scrapeAll(); // Ejecuta la tarea inmediatamente al invocar este endpoint
    }
    @ApiResponse({ status: 200, description: 'Operación exitosa', type: Object })
    @ApiResponse({ status: 500, description: 'Error interno del servidor' })

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    handleCron() {
        this.scrapeAll(); // Ejecuta la tarea programada cada 24 horas
    }

}