1. **同轮等待结果**：spawn 之后 SHALL 在本轮内等待（wait）coding subagent 返回，收到结果先逐字转达再确认；SHALL NOT 在 spawn 后结束本轮回合，留下"子 agent 已返回但主会话已退出、结果无人消费"的断链状态。
2. **禁止口头分发**：spawn / wait 都 SHALL 落到宿主的实际工具调用，SHALL NOT 仅以自然语言描述"已分发/将分发实施任务给 coding subagent"代替实际 spawn 与等待；出现"我将 spawn…"类描述而没有对应工具调用时，该输出不视为分发动作，不得据此结束本轮或进入下一步。
3. **消费完即关闭**：coding subagent 结果消费完毕（主会话确认与提交决策完成）SHALL 关闭它，SHALL NOT 假设 subagent 跨用户回合存活。
