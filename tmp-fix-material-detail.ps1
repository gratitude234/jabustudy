$path = 'app/study/materials/[id]/MaterialDetailClient.tsx'
$content = [System.IO.File]::ReadAllText($path)
$replacement = @'
                    {isMcqQuestion(currentQ) ? (
                      <>
                        <div className="space-y-2.5">
                          {(["A", "B", "C", "D"] as const).map((key) => {
                            const isCorrect = currentQ.answer === key;
                            const isChosen = currentAnswer?.chosen === key;
                            return (
                              <button key={key} type="button"
                                disabled={answered}
                                onClick={() => {
                                  if (answered) return;
                                  setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: { chosen: key, correct: isCorrect, skipped: false } }));
                                }}
                                className={cn(
                                  "flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm text-left transition focus-visible:outline-none",
                                  !answered && "hover:bg-secondary/50 border-border/60 text-foreground",
                                  answered && isCorrect && "border-primary bg-primary-light font-semibold text-primary-text",
                                  answered && isChosen && !isCorrect && "border-red-400 bg-red-50 font-semibold text-red-700",
                                  answered && !isCorrect && !isChosen && "border-border/40 text-muted-brand opacity-60",
                                )}>
                                <span className="shrink-0 font-bold">{key}.</span>
                                <span>{currentQ.options[key]}</span>
                              </button>
                            );
                          })}
                        </div>
                        {answered && (
                          <div className="mt-4 space-y-2">
                            <div className="rounded-xl border border-primary/20 bg-primary-light/60 px-4 py-3">
                              <p className="text-xs leading-relaxed text-primary-text/85">
                                <span className="font-semibold">Explanation: </span>{currentQ.explanation}
                              </p>
                            </div>
                            {isBetterExplanationOptionKey(currentAnswer?.chosen) ? (
                              <BetterExplanationInline
                                questionPrompt={currentQ.question}
                                options={currentQ.options}
                                chosenOptionKey={currentAnswer.chosen}
                                chosenOptionText={currentQ.options[currentAnswer.chosen]}
                                correctOptionKey={currentQ.answer}
                                correctOptionText={currentQ.options[currentQ.answer]}
                                isCorrect={currentAnswer.correct}
                                basicExplanation={currentQ.explanation}
                                studyRef={currentQ.studyRef}
                                sourceTopic={currentQ.sourceTopic}
                              />
                            ) : null}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-primary/30 bg-primary-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-text">
                            {questionTypeLabel(currentQuestionType)}
                          </span>
                        </div>
                        <textarea
                          value={currentWrittenAnswer}
                          onChange={(e) => {
                            const value = e.target.value;
                            setWrittenAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }));
                            if (!value.trim()) {
                              setWrittenCompared((prev) => ({ ...prev, [currentQuestionIndex]: false }));
                            }
                          }}
                          placeholder="Type your answer here..."
                          rows={currentQuestionType === "theory" ? 8 : 5}
                          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          disabled={!currentWrittenAnswer.trim()}
                          onClick={() => setWrittenCompared((prev) => ({ ...prev, [currentQuestionIndex]: true }))}
                          className="inline-flex items-center justify-center rounded-2xl border border-primary bg-primary-light px-4 py-2.5 text-sm font-semibold text-primary-text transition hover:opacity-90 disabled:opacity-40 focus-visible:outline-none"
                        >
                          Compare answer
                        </button>
                        {currentWrittenCompared && (
                          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary-light/60 px-4 py-3">
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-wide text-primary-text/80">Model answer</p>
                              <p className="mt-1 text-sm leading-relaxed text-primary-text">{currentQ.model_answer}</p>
                            </div>
                            {currentQ.marking_points.length > 0 && (
                              <div>
                                <p className="text-xs font-extrabold uppercase tracking-wide text-primary-text/80">Marking points</p>
                                <ul className="mt-1 space-y-1 text-sm leading-relaxed text-primary-text">
                                  {currentQ.marking_points.map((point, index) => (
                                    <li key={`${point}-${index}`}>- {point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {currentQ.explanation?.trim() && (
                              <p className="text-xs leading-relaxed text-primary-text/85">
                                <span className="font-semibold">Note: </span>{currentQ.explanation}
                              </p>
                            )}
                          </div>
                        )}
'@
$pattern = '(?s)^<<<<<<< HEAD\r?\n.*?^>>>>>>> 0b6b4b7e0f46702e317cef0d7539a9f58b4814c2\r?\n'
$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement + [Environment]::NewLine, 1, [System.Text.RegularExpressions.RegexOptions]::Multiline)
if ($newContent -eq $content) {
  throw 'Conflict block was not replaced.'
}
[System.IO.File]::WriteAllText($path, $newContent, [System.Text.UTF8Encoding]::new($false))
