import {Todo} from "@/types/api";

const TodoItem = ({todo}: {todo: Todo}) => {
return(
    <div className="todo-item">
        <span>{todo.todo}</span>
        <span>{todo.completed ? "✅" : "❌"}</span>
    </div>
)
}

export default TodoItem;
