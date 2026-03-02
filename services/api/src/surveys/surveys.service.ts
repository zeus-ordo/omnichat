import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateSurveyDto, UpdateSurveyDto, SubmitSurveyDto } from './dto/surveys.dto';

@Injectable()
export class SurveysService {
  constructor(private dataSource: DataSource) {}

  async createSurvey(createDto: CreateSurveyDto, tenantSchema: string, userId: string) {
    const { title, description, questions, trigger_keywords, is_active = true } = createDto;

    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.surveys (title, description, questions, trigger_keywords, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, JSON.stringify(questions), trigger_keywords, is_active, userId],
    );

    return result[0];
  }

  async getSurveys(tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.surveys ORDER BY created_at DESC`,
    );
    return result;
  }

  async getSurvey(id: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.surveys WHERE id = $1`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Survey not found');
    }

    return result[0];
  }

  async getActiveSurveyByKeyword(keyword: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.surveys 
       WHERE is_active = true 
       AND $1 = ANY(trigger_keywords)
       LIMIT 1`,
      [keyword.toLowerCase()],
    );

    return result[0] || null;
  }

  async updateSurvey(id: string, updateDto: UpdateSurveyDto, tenantSchema: string) {
    const { title, description, questions, trigger_keywords, is_active } = updateDto;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (questions !== undefined) {
      updates.push(`questions = $${paramIndex++}`);
      params.push(JSON.stringify(questions));
    }
    if (trigger_keywords !== undefined) {
      updates.push(`trigger_keywords = $${paramIndex++}`);
      params.push(trigger_keywords);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return this.getSurvey(id, tenantSchema);
    }

    params.push(id);

    const result = await this.dataSource.query(
      `UPDATE ${tenantSchema}.surveys 
       SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Survey not found');
    }

    return result[0];
  }

  async deleteSurvey(id: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `DELETE FROM ${tenantSchema}.surveys WHERE id = $1 RETURNING *`,
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Survey not found');
    }

    return result[0];
  }

  async submitSurveyResponse(submitDto: SubmitSurveyDto, tenantSchema: string) {
    const { conversation_id, survey_id, answers } = submitDto;

    const result = await this.dataSource.query(
      `INSERT INTO ${tenantSchema}.survey_responses (conversation_id, survey_id, answers)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversation_id, survey_id, JSON.stringify(answers)],
    );

    return result[0];
  }

  async getSurveyResponses(surveyId: string, tenantSchema: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.survey_responses 
       WHERE survey_id = $1 
       ORDER BY submitted_at DESC`,
      [surveyId],
    );
    return result;
  }

  async checkAndTriggerSurvey(userMessage: string, tenantSchema: string) {
    // Check if any active survey should be triggered
    const surveys = await this.dataSource.query(
      `SELECT * FROM ${tenantSchema}.surveys WHERE is_active = true`,
    );

    for (const survey of surveys) {
      const keywords = survey.trigger_keywords || [];
      for (const keyword of keywords) {
        if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
          return survey;
        }
      }
    }

    return null;
  }
}
