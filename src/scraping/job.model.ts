import * as mongoose from 'mongoose';

export const JobSchema = new mongoose.Schema({
    title: { type: String, required: true},
    //agregar mas campos como sean necesarios
});

export interface Job {
    title: string;
    //definir mas campos de ser necesario
}

export const JobModel = mongoose.model('Job', JobSchema);
