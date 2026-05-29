import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, target_value, unit, target_date, strategy_type } = await req.json();

    const client = new Anthropic();

    const parts = [`目標: ${title}`];
    if (target_value) parts.push(`目標値: ${Number(target_value).toLocaleString()} ${unit || ''}`);
    if (target_date) parts.push(`期限: ${target_date}`);
    if (strategy_type) parts.push(`カテゴリ: ${strategy_type}`);
    const userPrompt = parts.join('\n') +
      '\n\nこの目標を10年→1年→1ヶ月→1週間→今日の具体的アクションまで逆算で分解してください。';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `あなたは目標達成の専門家です。ユーザーの目標を受け取り、それを階層的に分解してください。必ずJSON形式のみで返してください。前置きや説明は不要です。
フォーマット:
{
  "subgoals": [
    {
      "title": "サブ目標名",
      "target_value": 数値またはnull,
      "unit": "単位またはnull",
      "horizon": "10年/1年/6ヶ月/1ヶ月/1週間/今日",
      "strategy": "savings/habit/skill/revenue/custom",
      "children": []
    }
  ],
  "today_action": "今日すぐできる具体的な一歩（1行）"
}`,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSONが見つかりません');
    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
