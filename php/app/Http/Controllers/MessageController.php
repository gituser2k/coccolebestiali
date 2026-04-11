<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class MessageController extends Controller
{
    public function saveMessage(Request $request): JsonResponse
    {
        $m = new Message();
        $validated = [];

        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'msg' => ['required', 'string', 'max:4096'],
            ]);

            $m->saveMessage($validated);

            return response()->json([
                'ok' => true,
            ], 200);
        }
        catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);
            
            return response()->json([
                'ok' => false,
            ], 500);
        }
        catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function getAdminMessages(): JsonResponse
    {
        try {
            $m = new Message();
            $rows = $m->getAdminMessages();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function getAdminErrors(): JsonResponse
    {
        try {
            $m = new Message();
            $rows = $m->getAdminErrors();

            return response()->json([
                'ok' => true,
                'data' => $rows,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [],
            ], 500);
        }
    }

    public function deleteAdminMessages(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['required', 'integer', 'min:1'],
            ]);

            $m = new Message();
            $deleted = $m->deleteAdminMessagesByIds($validated['ids']);

            return response()->json([
                'ok' => true,
                'deleted' => $deleted,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function replyAdminMessage(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'messageid' => ['required', 'integer', 'min:1'],
                'email' => ['required', 'email', 'max:255'],
                'reply' => ['required', 'string', 'max:4096'],
            ]);

            $m = new Message();
            $sourceMessage = $m->getMessageById((int) $validated['messageid']);
            $requestText = $sourceMessage ? (string) $sourceMessage->msg : '';
            $mailBody = "Risposta:\n".$validated['reply'];

            if ($requestText !== '') {
                $mailBody .= "\n\n------------------------------\n";
                $mailBody .= "Messaggio di richiesta:\n".$requestText;
            }

            Mail::raw($mailBody, function ($message) use ($validated) {
                $message
                    ->from('info@coccolebestiali.it', 'Coccole Bestiali')
                    ->to($validated['email'])
                    ->subject('Coccole Bestiali - Richiesta Informazioni');
            });

            $m->saveMessageBack((int) $validated['messageid'], $validated['reply']);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function getLastAdminMessageReply(int $messageId): JsonResponse
    {
        try {
            $m = new Message();
            $reply = $m->getLastMessageBackByMessageId($messageId);

            return response()->json([
                'ok' => true,
                'data' => [
                    'replymsg' => $reply,
                ],
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError(['messageid' => $messageId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [
                    'replymsg' => null,
                ],
            ], 500);
        } catch (Exception $e) {
            Utility::saveError(['messageid' => $messageId], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'data' => [
                    'replymsg' => null,
                ],
            ], 500);
        }
    }
}
