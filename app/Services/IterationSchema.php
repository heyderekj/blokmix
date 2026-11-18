<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;

class IterationSchema
{
    /** Both schemas are generated from the editor's command definitions. */
    public static function check(string $name, mixed $value): void
    {
        $schema = json_decode(file_get_contents(resource_path("schemas/$name.json")), flags: JSON_THROW_ON_ERROR);
        $error = (new Validator)->validate($value, $schema)->error();
        if ($error) {
            throw ValidationException::withMessages([$name => (new ErrorFormatter)->formatFlat($error)]);
        }
    }
}
