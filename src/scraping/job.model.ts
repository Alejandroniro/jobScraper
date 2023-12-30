import * as mongoose from 'mongoose';

export const JobSchema = new mongoose.Schema({
    title: { type: String, unique: true },
    company: { type: String, },
    location: { type: String, },
    salary: { type: String, },
    keyword: { type: [String], },
    requirement: {
        education: { type: String },
        experience: { type: String },
        languages: { type: String },
        skills: { type: [String] },
    },
});

JobSchema.index({ title: 1 }, { unique: true });  // Esto asegura que el campo 'title' sea único

export interface Job extends mongoose.Document {
    title: string;
    company: string;
    location: string;
    salary: string;
    keyword: string[];
    requirement: {
        education?: string;
        experience?: string;
        languages?: string;
        skills?: string[];
    };
}

export const JobModel = mongoose.model<Job>('Job', JobSchema);