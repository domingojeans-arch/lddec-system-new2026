'use server';
/**
 * @fileOverview An AI agent to standardize garment condition descriptions.
 *
 * - standardizeGarmentDescription - A function that generates a standardized description based on observations.
 * - StandardizeGarmentDescriptionInput - The input type for the standardizeGarmentDescription function.
 * - StandardizeGarmentDescriptionOutput - The return type for the standardizeGarmentDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StandardizeGarmentDescriptionInputSchema = z.object({
  garmentType: z.string().describe('The type of garment, e.g., "shirt", "jeans", "jacket".'),
  color: z.string().describe('The color of the garment, e.g., "blue", "black", "red".'),
  material: z.string().describe('The material of the garment, e.g., "cotton", "denim", "leather".'),
  conditionObservations: z
    .string()
    .describe(
      'Free-text observations about the garment\'s condition, e.g., "small tear on the left sleeve", "faded color", "missing button", "good condition".'
    ),
  wearLevel: z
    .string()
    .describe('The general wear level of the garment, e.g., "new", "lightly worn", "moderately worn", "heavily worn".'),
});
export type StandardizeGarmentDescriptionInput = z.infer<typeof StandardizeGarmentDescriptionInputSchema>;

const StandardizeGarmentDescriptionOutputSchema = z.object({
  standardizedDescription: z.string().describe('A clear, concise, and standardized description of the garment\'s condition.'),
});
export type StandardizeGarmentDescriptionOutput = z.infer<typeof StandardizeGarmentDescriptionOutputSchema>;

export async function standardizeGarmentDescription(
  input: StandardizeGarmentDescriptionInput
): Promise<StandardizeGarmentDescriptionOutput> {
  return standardizeGarmentDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'standardizeGarmentDescriptionPrompt',
  input: {schema: StandardizeGarmentDescriptionInputSchema},
  output: {schema: StandardizeGarmentDescriptionOutputSchema},
  prompt: `You are an expert in textile and garment quality control. Your task is to generate a concise, standardized, and objective description of a garment's condition based on the provided observations.

Focus on clarity, accuracy, and consistency across descriptions. Avoid subjective language or emotional terms.

Garment Type: {{{garmentType}}}
Color: {{{color}}}
Material: {{{material}}}
Wear Level: {{{wearLevel}}}
Observations: {{{conditionObservations}}}

Based on the above information, provide a standardized description of the garment's condition.`,
});

const standardizeGarmentDescriptionFlow = ai.defineFlow(
  {
    name: 'standardizeGarmentDescriptionFlow',
    inputSchema: StandardizeGarmentDescriptionInputSchema,
    outputSchema: StandardizeGarmentDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate standardized garment description.');
    }
    return output;
  }
);
