public class Main {
    public static void main(String[] args) {
        int[] route = {3, 2, 1};
        int[] turns = {0, 1, 0};
        route[2] = 3;
        for (int i = 0; i < 3; i++) {
            if (turns[i] == 1) {
                turnLeft();
            }
            for (int n = 0; n < route[i]; n++) {
                move();
            }
        }
    }
}
