import type { ValidationError } from '@/types/errors';
import type { Result } from '@/types/result';
import { err, ok } from '@/types/result';

const FIRST_MESSAGE_MIN_LENGTH = 1;
const FIRST_MESSAGE_MAX_LENGTH = 4000;
const FIRST_MESSAGE_VALIDATION_MESSAGE = `Message must be between ${FIRST_MESSAGE_MIN_LENGTH} and ${FIRST_MESSAGE_MAX_LENGTH} characters`;

export function validateFirstMessageText(text: string): Result<string, ValidationError> {
  const normalizedText = text.trim();

  if (normalizedText.length < FIRST_MESSAGE_MIN_LENGTH || normalizedText.length > FIRST_MESSAGE_MAX_LENGTH) {
    return err({
      type: 'VALIDATION_ERROR',
      message: FIRST_MESSAGE_VALIDATION_MESSAGE,
    });
  }

  return ok(normalizedText);
}
